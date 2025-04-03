# Tokenized Sustainable Fishery Management System

A blockchain-based solution for transparent and sustainable fishery management using Clarity smart contracts.

## Overview

This system provides a comprehensive solution for managing fishing activities, ensuring sustainability, and enabling traceability from catch to market. By leveraging blockchain technology, it creates transparent and immutable records of fishing activities, quota allocations, and certifications.

## Key Components

### Vessel Registration Contract

The vessel registration contract maintains a registry of all fishing vessels in the system.

**Features:**
- Register new vessels with owner information
- Update vessel status (active/inactive)
- Query vessel details and ownership
- Prevent blacklisted entities from registering vessels

### Quota Allocation Contract

The quota allocation contract manages sustainable catch limits for different species.

**Features:**
- Allocate quotas to vessels for specific species
- Track quota usage
- Set expiration dates for quotas
- Verify if a vessel has sufficient quota for a catch

### Catch Reporting Contract

The catch reporting contract records details of fish harvested by vessels.

**Features:**
- Report catches with species, amount, and location data
- Verify catches by authorized entities
- Check if catches comply with allocated quotas
- Maintain a transparent record of all fishing activities

### Market Access Contract

The market access contract verifies compliance for selling certified seafood.

**Features:**
- Certify catches that meet sustainability requirements
- Manage blacklisting of non-compliant entities
- Verify certification status for market access
- Set expiration dates for certifications

## How It Works

1. **Vessel Registration**: Fishing vessel owners register their vessels in the system.
2. **Quota Allocation**: Regulatory authorities allocate sustainable catch quotas to registered vessels.
3. **Catch Reporting**: Vessel owners report their catches, which are verified against their allocated quotas.
4. **Certification**: Verified catches receive certification for market access.
5. **Market Access**: Only certified catches can be sold in the marketplace.

## Technical Implementation

The system is implemented using Clarity smart contracts on the Stacks blockchain. The contracts are designed to be simple, secure, and interoperable.

### Contract Interactions

