import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity environment
const mockClarity = {
  contracts: {
    'quota-allocation': {
      functions: {
        'allocate-quota': vi.fn(),
        'use-quota': vi.fn(),
        'get-remaining-quota': vi.fn(),
        'is-quota-valid': vi.fn()
      }
    },
    'vessel-registration': {
      functions: {
        'is-vessel-active': vi.fn()
      }
    }
  },
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // Contract owner
  },
  block: {
    height: 100
  }
};

// Mock implementation for quota allocation
const quotaAllocationImpl = {
  quotas: new Map(),
  
  allocateQuota(vesselId, species, amount, expiryBlocks) {
    // Check if sender is contract owner
    if (mockClarity.tx.sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
      return { err: 401 };
    }
    
    // Check if vessel exists and is active
    if (!mockClarity.contracts['vessel-registration'].functions['is-vessel-active'](vesselId)) {
      return { err: 404 };
    }
    
    const key = `${vesselId}-${species}`;
    this.quotas.set(key, {
      allocatedAmount: amount,
      usedAmount: 0,
      expiryHeight: mockClarity.block.height + expiryBlocks
    });
    
    return { ok: true };
  },
  
  useQuota(vesselId, species, amount) {
    const key = `${vesselId}-${species}`;
    if (!this.quotas.has(key)) {
      return { err: 404 };
    }
    
    const quota = this.quotas.get(key);
    
    // Check if quota is still valid
    if (mockClarity.block.height >= quota.expiryHeight) {
      return { err: 410 };
    }
    
    // Check if there's enough quota left
    const newUsedAmount = quota.usedAmount + amount;
    if (newUsedAmount > quota.allocatedAmount) {
      return { err: 409 };
    }
    
    // Update the used amount
    quota.usedAmount = newUsedAmount;
    this.quotas.set(key, quota);
    
    return { ok: true };
  },
  
  getRemainingQuota(vesselId, species) {
    const key = `${vesselId}-${species}`;
    if (!this.quotas.has(key)) {
      return { none: true };
    }
    
    const quota = this.quotas.get(key);
    if (mockClarity.block.height >= quota.expiryHeight) {
      return { none: true };
    }
    
    return { some: quota.allocatedAmount - quota.usedAmount };
  },
  
  isQuotaValid(vesselId, species, amount) {
    const key = `${vesselId}-${species}`;
    if (!this.quotas.has(key)) {
      return false;
    }
    
    const quota = this.quotas.get(key);
    return (
        mockClarity.block.height < quota.expiryHeight &&
        quota.usedAmount + amount <= quota.allocatedAmount
    );
  }
};

// Setup mocks
beforeEach(() => {
  // Reset quota allocation state
  quotaAllocationImpl.quotas = new Map();
  
  // Setup mock functions
  mockClarity.contracts['quota-allocation'].functions['allocate-quota'].mockImplementation(
      (vesselId, species, amount, expiryBlocks) =>
          quotaAllocationImpl.allocateQuota(vesselId, species, amount, expiryBlocks)
  );
  
  mockClarity.contracts['quota-allocation'].functions['use-quota'].mockImplementation(
      (vesselId, species, amount) => quotaAllocationImpl.useQuota(vesselId, species, amount)
  );
  
  mockClarity.contracts['quota-allocation'].functions['get-remaining-quota'].mockImplementation(
      (vesselId, species) => quotaAllocationImpl.getRemainingQuota(vesselId, species)
  );
  
  mockClarity.contracts['quota-allocation'].functions['is-quota-valid'].mockImplementation(
      (vesselId, species, amount) => quotaAllocationImpl.isQuotaValid(vesselId, species, amount)
  );
  
  mockClarity.contracts['vessel-registration'].functions['is-vessel-active'].mockReturnValue(true);
});

describe('Quota Allocation Contract', () => {
  it('should allocate quota to a vessel', () => {
    const result = mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    expect(result).toEqual({ ok: true });
    expect(quotaAllocationImpl.quotas.size).toBe(1);
    
    const quota = quotaAllocationImpl.quotas.get('1-Tuna');
    expect(quota.allocatedAmount).toBe(1000);
    expect(quota.usedAmount).toBe(0);
    expect(quota.expiryHeight).toBe(1100); // Current height (100) + expiry blocks (1000)
  });
  
  it('should not allocate quota if vessel is not active', () => {
    mockClarity.contracts['vessel-registration'].functions['is-vessel-active'].mockReturnValue(false);
    
    const result = mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    expect(result).toEqual({ err: 404 });
    expect(quotaAllocationImpl.quotas.size).toBe(0);
  });
  
  it('should not allocate quota if not contract owner', () => {
    // Change the sender
    const originalSender = mockClarity.tx.sender;
    mockClarity.tx.sender = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    const result = mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    expect(result).toEqual({ err: 401 });
    expect(quotaAllocationImpl.quotas.size).toBe(0);
    
    // Restore sender
    mockClarity.tx.sender = originalSender;
  });
  
  it('should use quota', () => {
    // First allocate quota
    mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    // Then use some of it
    const result = mockClarity.contracts['quota-allocation'].functions['use-quota'](1, 'Tuna', 300);
    
    expect(result).toEqual({ ok: true });
    
    const quota = quotaAllocationImpl.quotas.get('1-Tuna');
    expect(quota.usedAmount).toBe(300);
  });
  
  it('should not use quota if not enough remaining', () => {
    // First allocate quota
    mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    // Try to use more than allocated
    const result = mockClarity.contracts['quota-allocation'].functions['use-quota'](1, 'Tuna', 1200);
    
    expect(result).toEqual({ err: 409 });
    
    const quota = quotaAllocationImpl.quotas.get('1-Tuna');
    expect(quota.usedAmount).toBe(0); // Unchanged
  });
  
  it('should not use quota if expired', () => {
    // First allocate quota
    mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    // Move block height past expiry
    mockClarity.block.height = 1200;
    
    // Try to use quota
    const result = mockClarity.contracts['quota-allocation'].functions['use-quota'](1, 'Tuna', 300);
    
    expect(result).toEqual({ err: 410 });
    
    const quota = quotaAllocationImpl.quotas.get('1-Tuna');
    expect(quota.usedAmount).toBe(0); // Unchanged
  });
  
  it('should get remaining quota', () => {
    // First allocate quota
    mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    // Use some quota
    mockClarity.contracts['quota-allocation'].functions['use-quota'](1, 'Tuna', 300);
    
    // Get remaining quota
    const remaining = mockClarity.contracts['quota-allocation'].functions['get-remaining-quota'](1, 'Tuna');
    
    expect(remaining).toEqual({ some: 700 });
  });
  
  it('should check if quota is valid', () => {
    // First allocate quota
    mockClarity.contracts['quota-allocation'].functions['allocate-quota'](1, 'Tuna', 1000, 1000);
    
    // Check if valid for a certain amount
    let isValid = mockClarity.contracts['quota-allocation'].functions['is-quota-valid'](1, 'Tuna', 800);
    expect(isValid).toBe(true);
    
    // Check if valid for more than allocated
    isValid = mockClarity.contracts['quota-allocation'].functions['is-quota-valid'](1, 'Tuna', 1200);
    expect(isValid).toBe(false);
    
    // Use some quota
    mockClarity.contracts['quota-allocation'].functions['use-quota'](1, 'Tuna', 300);
    
    // Check if valid for remaining
    isValid = mockClarity.contracts['quota-allocation'].functions['is-quota-valid'](1, 'Tuna', 700);
    expect(isValid).toBe(true);
    
    // Check if valid for more than remaining
    isValid = mockClarity.contracts['quota-allocation'].functions['is-quota-valid'](1, 'Tuna', 800);
    expect(isValid).toBe(false);
  });
});
