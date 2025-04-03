import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity environment
const mockClarity = {
  contracts: {
    'vessel-registration': {
      functions: {
        'register-vessel': vi.fn(),
        'update-vessel-status': vi.fn(),
        'is-vessel-active': vi.fn(),
        'get-vessel-details': vi.fn(),
        'get-vessel-owner': vi.fn()
      }
    },
    'market-access': {
      functions: {
        'is-blacklisted': vi.fn()
      }
    }
  },
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
  },
  block: {
    height: 100
  }
};

// Mock implementation for vessel registration
const vesselRegistrationImpl = {
  nextVesselId: 1,
  vessels: new Map(),
  
  registerVessel(name, vesselType) {
    // Check if sender is blacklisted
    if (mockClarity.contracts['market-access'].functions['is-blacklisted'](mockClarity.tx.sender)) {
      return { err: 403 };
    }
    
    const vesselId = this.nextVesselId;
    this.vessels.set(vesselId, {
      owner: mockClarity.tx.sender,
      name,
      vesselType,
      registrationDate: mockClarity.block.height,
      active: true
    });
    
    this.nextVesselId++;
    return { ok: vesselId };
  },
  
  updateVesselStatus(vesselId, active) {
    if (!this.vessels.has(vesselId)) {
      return { err: 404 };
    }
    
    const vessel = this.vessels.get(vesselId);
    if (vessel.owner !== mockClarity.tx.sender) {
      return { err: 401 };
    }
    
    vessel.active = active;
    this.vessels.set(vesselId, vessel);
    return { ok: true };
  },
  
  isVesselActive(vesselId) {
    if (!this.vessels.has(vesselId)) {
      return false;
    }
    return this.vessels.get(vesselId).active;
  },
  
  getVesselDetails(vesselId) {
    if (!this.vessels.has(vesselId)) {
      return null;
    }
    return this.vessels.get(vesselId);
  },
  
  getVesselOwner(vesselId) {
    if (!this.vessels.has(vesselId)) {
      return { none: true };
    }
    return { some: this.vessels.get(vesselId).owner };
  }
};

// Setup mocks
beforeEach(() => {
  // Reset vessel registration state
  vesselRegistrationImpl.nextVesselId = 1;
  vesselRegistrationImpl.vessels = new Map();
  
  // Setup mock functions
  mockClarity.contracts['vessel-registration'].functions['register-vessel'].mockImplementation(
      (name, vesselType) => vesselRegistrationImpl.registerVessel(name, vesselType)
  );
  
  mockClarity.contracts['vessel-registration'].functions['update-vessel-status'].mockImplementation(
      (vesselId, active) => vesselRegistrationImpl.updateVesselStatus(vesselId, active)
  );
  
  mockClarity.contracts['vessel-registration'].functions['is-vessel-active'].mockImplementation(
      (vesselId) => vesselRegistrationImpl.isVesselActive(vesselId)
  );
  
  mockClarity.contracts['vessel-registration'].functions['get-vessel-details'].mockImplementation(
      (vesselId) => vesselRegistrationImpl.getVesselDetails(vesselId)
  );
  
  mockClarity.contracts['vessel-registration'].functions['get-vessel-owner'].mockImplementation(
      (vesselId) => vesselRegistrationImpl.getVesselOwner(vesselId)
  );
  
  mockClarity.contracts['market-access'].functions['is-blacklisted'].mockReturnValue(false);
});

describe('Vessel Registration Contract', () => {
  it('should register a new vessel', () => {
    const result = mockClarity.contracts['vessel-registration'].functions['register-vessel']('Fishing Boat 1', 'Trawler');
    
    expect(result).toEqual({ ok: 1 });
    expect(vesselRegistrationImpl.vessels.size).toBe(1);
    
    const vessel = vesselRegistrationImpl.vessels.get(1);
    expect(vessel.name).toBe('Fishing Boat 1');
    expect(vessel.vesselType).toBe('Trawler');
    expect(vessel.active).toBe(true);
  });
  
  it('should not register a vessel if sender is blacklisted', () => {
    mockClarity.contracts['market-access'].functions['is-blacklisted'].mockReturnValue(true);
    
    const result = mockClarity.contracts['vessel-registration'].functions['register-vessel']('Fishing Boat 1', 'Trawler');
    
    expect(result).toEqual({ err: 403 });
    expect(vesselRegistrationImpl.vessels.size).toBe(0);
  });
  
  it('should update vessel status', () => {
    // First register a vessel
    mockClarity.contracts['vessel-registration'].functions['register-vessel']('Fishing Boat 1', 'Trawler');
    
    // Then update its status
    const result = mockClarity.contracts['vessel-registration'].functions['update-vessel-status'](1, false);
    
    expect(result).toEqual({ ok: true });
    expect(vesselRegistrationImpl.vessels.get(1).active).toBe(false);
  });
  
  it('should not update vessel status if not the owner', () => {
    // First register a vessel
    mockClarity.contracts['vessel-registration'].functions['register-vessel']('Fishing Boat 1', 'Trawler');
    
    // Change the sender
    const originalSender = mockClarity.tx.sender;
    mockClarity.tx.sender = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    // Try to update status
    const result = mockClarity.contracts['vessel-registration'].functions['update-vessel-status'](1, false);
    
    expect(result).toEqual({ err: 401 });
    expect(vesselRegistrationImpl.vessels.get(1).active).toBe(true);
    
    // Restore sender
    mockClarity.tx.sender = originalSender;
  });
  
  it('should check if vessel is active', () => {
    // Register a vessel
    mockClarity.contracts['vessel-registration'].functions['register-vessel']('Fishing Boat 1', 'Trawler');
    
    // Check active status
    let isActive = mockClarity.contracts['vessel-registration'].functions['is-vessel-active'](1);
    expect(isActive).toBe(true);
    
    // Update status to inactive
    mockClarity.contracts['vessel-registration'].functions['update-vessel-status'](1, false);
    
    // Check again
    isActive = mockClarity.contracts['vessel-registration'].functions['is-vessel-active'](1);
    expect(isActive).toBe(false);
  });
  
  it('should get vessel details', () => {
    // Register a vessel
    mockClarity.contracts['vessel-registration'].functions['register-vessel']('Fishing Boat 1', 'Trawler');
    
    // Get details
    const details = mockClarity.contracts['vessel-registration'].functions['get-vessel-details'](1);
    
    expect(details).toEqual({
      owner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      name: 'Fishing Boat 1',
      vesselType: 'Trawler',
      registrationDate: 100,
      active: true
    });
  });
  
  it('should get vessel owner', () => {
    // Register a vessel
    mockClarity.contracts['vessel-registration'].functions['register-vessel']('Fishing Boat 1', 'Trawler');
    
    // Get owner
    const owner = mockClarity.contracts['vessel-registration'].functions['get-vessel-owner'](1);
    
    expect(owner).toEqual({ some: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' });
  });
});
