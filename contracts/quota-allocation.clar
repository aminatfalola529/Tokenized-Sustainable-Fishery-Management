;; Quota Allocation Contract
;; Manages sustainable catch limits

;; Define data variables
(define-map quotas
  { vessel-id: uint, species: (string-utf8 30) }
  {
    allocated-amount: uint,
    used-amount: uint,
    expiry-height: uint
  }
)

;; Allocate quota to a vessel
(define-public (allocate-quota (vessel-id uint) (species (string-utf8 30)) (amount uint) (expiry-blocks uint))
  (begin
    ;; Only contract owner can allocate quotas
    (asserts! (is-eq tx-sender contract-owner) (err u401))

    ;; Set the quota
    (map-set quotas
      { vessel-id: vessel-id, species: species }
      {
        allocated-amount: amount,
        used-amount: u0,
        expiry-height: (+ block-height expiry-blocks)
      }
    )
    (ok true)
  )
)

;; Use quota (called by catch reporting contract)
(define-public (use-quota (vessel-id uint) (species (string-utf8 30)) (amount uint))
  (let
    (
      (quota (unwrap! (map-get? quotas { vessel-id: vessel-id, species: species }) (err u404)))
      (new-used-amount (+ (get used-amount quota) amount))
    )
    ;; Check if quota is still valid
    (asserts! (< block-height (get expiry-height quota)) (err u410))

    ;; Check if there's enough quota left
    (asserts! (<= new-used-amount (get allocated-amount quota)) (err u409))

    ;; Update the used amount
    (map-set quotas
      { vessel-id: vessel-id, species: species }
      (merge quota { used-amount: new-used-amount })
    )
    (ok true)
  )
)

;; Check remaining quota
(define-read-only (get-remaining-quota (vessel-id uint) (species (string-utf8 30)))
  (match (map-get? quotas { vessel-id: vessel-id, species: species })
    quota (if (< block-height (get expiry-height quota))
            (some (- (get allocated-amount quota) (get used-amount quota)))
            none)
    none
  )
)

;; Check if quota is valid and sufficient
(define-read-only (is-quota-valid (vessel-id uint) (species (string-utf8 30)) (amount uint))
  (match (map-get? quotas { vessel-id: vessel-id, species: species })
    quota (and
            (< block-height (get expiry-height quota))
            (<= (+ (get used-amount quota) amount) (get allocated-amount quota)))
    false
  )
)

;; Contract owner
(define-constant contract-owner tx-sender)

