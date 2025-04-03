;; Market Access Contract
;; Verifies compliance for selling certified seafood

;; Define data variables
(define-map certifications
  { catch-id: uint }
  {
    certification-date: uint,
    expiry-date: uint,
    certification-authority: principal
  }
)

(define-map blacklisted-entities
  { entity: principal }
  { reason: (string-utf8 100), blacklisted-at: uint }
)

;; Certify a catch for market access
(define-public (certify-catch (catch-id uint) (is-verified bool) (expiry-blocks uint))
  (begin
    ;; Only authorized certifiers can certify catches
    (asserts! (is-authorized-certifier tx-sender) (err u401))

    ;; Check if catch is verified (passed as parameter)
    (asserts! is-verified (err u403))

    ;; Issue certification
    (map-set certifications
      { catch-id: catch-id }
      {
        certification-date: block-height,
        expiry-date: (+ block-height expiry-blocks),
        certification-authority: tx-sender
      }
    )
    (ok true)
  )
)

;; Check if a catch is certified and certification is valid
(define-read-only (is-catch-certified (catch-id uint))
  (match (map-get? certifications { catch-id: catch-id })
    cert (< block-height (get expiry-date cert))
    false
  )
)

;; Get certification details
(define-read-only (get-certification-details (catch-id uint))
  (map-get? certifications { catch-id: catch-id })
)

;; Blacklist an entity for non-compliance
(define-public (blacklist-entity (entity principal) (reason (string-utf8 100)))
  (begin
    ;; Only contract owner can blacklist entities
    (asserts! (is-eq tx-sender contract-owner) (err u401))

    ;; Add to blacklist
    (map-set blacklisted-entities
      { entity: entity }
      { reason: reason, blacklisted-at: block-height }
    )
    (ok true)
  )
)

;; Remove entity from blacklist
(define-public (remove-from-blacklist (entity principal))
  (begin
    ;; Only contract owner can remove from blacklist
    (asserts! (is-eq tx-sender contract-owner) (err u401))

    ;; Remove from blacklist
    (map-delete blacklisted-entities { entity: entity })
    (ok true)
  )
)

;; Check if entity is blacklisted
(define-read-only (is-blacklisted (entity principal))
  (is-some (map-get? blacklisted-entities { entity: entity }))
)

;; Authorized certifiers
(define-map authorized-certifiers principal bool)

;; Add authorized certifier (only contract owner)
(define-public (add-authorized-certifier (certifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err u401))
    (map-set authorized-certifiers certifier true)
    (ok true)
  )
)

;; Check if principal is authorized certifier
(define-read-only (is-authorized-certifier (certifier principal))
  (default-to false (map-get? authorized-certifiers certifier))
)

;; Contract owner
(define-constant contract-owner tx-sender)

