import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity environment
const mockClarity = {
  contracts: {
    'catch-reporting': {
      functions: {
        'report-catch': vi.fn(),
        'verify-catch': vi.fn(),
        'get-catch-details': vi.fn(),
        'is-catch-verified': vi.fn(),
        'add-authorized-verifier': vi.fn(),
        'is-authorized-verifier': vi.fn()
      }
    },
    'vessel-registration': {
      functions: {
        'is-vessel-active': vi.fn(),
        'get-vessel-owner': vi.fn()
      }
    },
    'quota-allocation': {
      functions: {
        'is-quota-valid': vi.fn(),
        'use-quota': vi.fn()
      }
    }
  },
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // Contract owner and vessel owner
  },
  block: {
    height: 100
  }
};

// Mock implementation for catch reporting
const catchReportingImpl = {
  nextCatchId: 1,
  catches: new Map(),
  authorizedVerifiers: new Map(),
  
  reportCatch(vesselId, species, amount, latitude, longitude) {
    // Check if caller is the vessel owner
    const vesselOwner = mockClarity.contracts['vessel-registration'].functions['get-vessel-owner'](vesselId);
    if (!vesselOwner || vesselOwner.none || vesselOwner.some !== mockClarity.tx.sender) {
      return { err: 401 };
    }
    
    // Check if vessel is active
    if (!mockClarity.contracts['vessel-registration'].functions['is-vessel-active'](vesselId)) {
      return { err: 403 };
    }
    
    // Check if there's enough quota
    if (!mockClarity.contracts['quota-allocation'].functions['is-quota-valid'](vesselId, species, amount)) {
      return { err: 409 };
    }
    
    // Use the quota
    const useQuotaResult = mockClarity.contracts['quota-allocation'].functions['use-quota'](vesselId, species, amount);
    if (useQuotaResult.err) {
      return { err: 500 };
    }
    
    // Record the catch
    const catchId = this.nextCatchId;
    this.catches.set(catchId, {
      vesselId,
      species,
      amount,
      location: {
        latitude,
        longitude
      },
      timestamp: mockClarity.block.height,
      verified: false
    });
    
    this.nextCatchId++;
    return { ok: catchId };
  },
  
  verifyCatch(catchId) {
    // Check if catch exists
    if (!this.catches.has(catchId)) {
      return { err: 404 };
    }
    
    // Check if caller is authorized verifier
    if (!this.isAuthorizedVerifier(mockClarity.tx.sender)) {
      return { err: 401 };
    }
    
    // Update verification status
    const catchRecord = this.catches.get(catchId);
    catchRecord.verified = true;
    this.catches.set(catchId, catchRecord);
    
    return { ok: true };
  },
  
  getCatchDetails(catchId) {
    if (!this.catches.has(catchId)) {
      return null;
    }
    return this.catches.get(catchId);
  },
  
  isCatchVerified(catchId) {
    if (!this.catches.has(catchId)) {
      return false;
    }
    return this.catches.get(catchId).verified;
  },
  
  addAuthorizedVerifier(verifier) {
    // Only contract owner can add verifiers
    if (mockClarity.tx.sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
      return { err: 401 };
    }
    
    this.authorizedVerifiers.set(verifier, true);
    return { ok: true };
  },
  
  isAuthorizedVerifier(verifier) {
    return this.authorizedVerifiers.has(verifier);
  }
};

// Setup mocks
beforeEach(() => {
  // Reset catch reporting state
  catchReportingImpl.nextCatchId = 1;
  catchReportingImpl.catches = new Map();
  catchReportingImpl.authorizedVerifiers = new Map();
  
  // Setup mock functions
  mockClarity.contracts['catch-reporting'].functions['report-catch'].mockImplementation(
      (vesselId, species, amount, latitude, longitude) =>
          catchReportingImpl.reportCatch(vesselId, species, amount, latitude, longitude)
  );
  
  mockClarity.contracts['catch-reporting'].functions['verify-catch'].mockImplementation(
      (catchId) => catchReportingImpl.verifyCatch(catchId)
  );
  
  mockClarity.contracts['catch-reporting'].functions['get-catch-details'].mockImplementation(
      (catchId) => catchReportingImpl.getCatchDetails(catchId)
  );
  
  mockClarity.contracts['catch-reporting'].functions['is-catch-verified'].mockImplementation(
      (catchId) => catchReportingImpl.isCatchVerified(catchId)
  );
  
  mockClarity.contracts['catch-reporting'].functions['add-authorized-verifier'].mockImplementation(
      (verifier) => catchReportingImpl.addAuthorizedVerifier(verifier)
  );
  
  mockClarity.contracts['catch-reporting'].functions['is-authorized-verifier'].mockImplementation(
      (verifier) => catchReportingImpl.isAuthorizedVerifier(verifier)
  );
  
  // Setup vessel registration mocks
  mockClarity.contracts['vessel-registration'].functions['is-vessel-active'].mockReturnValue(true);
  mockClarity.contracts['vessel-registration'].functions['get-vessel-owner'].mockReturnValue({
    some: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
  });
  
  // Setup quota allocation mocks
  mockClarity.contracts['quota-allocation'].functions['is-quota-valid'].mockReturnValue(true);
  mockClarity.contracts['quota-allocation'].functions['use-quota'].mockReturnValue({ ok: true });
});

describe('Catch Reporting Contract', () => {
  it('should report a new catch', () => {
    const result = mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    expect(result).toEqual({ ok: 1 });
    expect(catchReportingImpl.catches.size).toBe(1);
    
    const catchRecord = catchReportingImpl.catches.get(1);
    expect(catchRecord.vesselId).toBe(1);
    expect(catchRecord.species).toBe('Tuna');
    expect(catchRecord.amount).toBe(300);
    expect(catchRecord.verified).toBe(false);
  });
  
  it('should not report catch if not vessel owner', () => {
    mockClarity.contracts['vessel-registration'].functions['get-vessel-owner'].mockReturnValue({
      some: 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
    });
    
    const result = mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    expect(result).toEqual({ err: 401 });
    expect(catchReportingImpl.catches.size).toBe(0);
  });
  
  it('should not report catch if vessel is not active', () => {
    mockClarity.contracts['vessel-registration'].functions['is-vessel-active'].mockReturnValue(false);
    
    const result = mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    expect(result).toEqual({ err: 403 });
    expect(catchReportingImpl.catches.size).toBe(0);
  });
  
  it('should not report catch if quota is not valid', () => {
    mockClarity.contracts['quota-allocation'].functions['is-quota-valid'].mockReturnValue(false);
    
    const result = mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    expect(result).toEqual({ err: 409 });
    expect(catchReportingImpl.catches.size).toBe(0);
  });
  
  it('should verify a catch', () => {
    // First report a catch
    mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    // Add an authorized verifier
    mockClarity.contracts['catch-reporting'].functions['add-authorized-verifier'](
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
    );
    
    // Verify the catch
    const result = mockClarity.contracts['catch-reporting'].functions['verify-catch'](1);
    
    expect(result).toEqual({ ok: true });
    expect(catchReportingImpl.catches.get(1).verified).toBe(true);
  });
  
  it('should not verify catch if not authorized', () => {
    // First report a catch
    mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    // Try to verify without authorization
    const result = mockClarity.contracts['catch-reporting'].functions['verify-catch'](1);
    
    expect(result).toEqual({ err: 401 });
    expect(catchReportingImpl.catches.get(1).verified).toBe(false);
  });
  
  it('should get catch details', () => {
    // First report a catch
    mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    // Get details
    const details = mockClarity.contracts['catch-reporting'].functions['get-catch-details'](1);
    
    expect(details).toEqual({
      vesselId: 1,
      species: 'Tuna',
      amount: 300,
      location: {
        latitude: 40000000,
        longitude: -70000000
      },
      timestamp: 100,
      verified: false
    });
  });
  
  it('should check if catch is verified', () => {
    // First report a catch
    mockClarity.contracts['catch-reporting'].functions['report-catch'](
        1, 'Tuna', 300, 40000000, -70000000
    );
    
    // Check verification status
    let isVerified = mockClarity.contracts['catch-reporting'].functions['is-catch-verified'](1);
    expect(isVerified).toBe(false);
    
    // Add an authorized verifier
    mockClarity.contracts['catch-reporting'].functions['add-authorized-verifier'](
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
    );
    
    // Verify the catch
    mockClarity.contracts['catch-reporting'].functions['verify-catch'](1);
    
    // Check again
    isVerified = mockClarity.contracts['catch-reporting'].functions['is-catch-verified'](1);
    expect(isVerified).toBe(true);
  });
});
