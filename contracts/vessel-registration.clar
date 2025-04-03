;; Vessel Registration Contract
;; Records details of fishing boats and equipment

;; Define data variables
(define-data-var next-vessel-id uint u1)
(define-map vessels
  { vessel-id: uint }
  {
    owner: principal,
    name: (string-utf8 50),
    vessel-type: (string-utf8 20),
    registration-date: uint,
    active: bool
  }
)

;; Register a new vessel
(define-public (register-vessel (name (string-utf8 50)) (vessel-type (string-utf8 20)))
  (let
    (
      (vessel-id (var-get next-vessel-id))
      (caller tx-sender)
    )
    ;; Record the vessel
    (map-set vessels
      { vessel-id: vessel-id }
      {
        owner: caller,
        name: name,
        vessel-type: vessel-type,
        registration-date: block-height,
        active: true
      }
    )
    (var-set next-vessel-id (+ vessel-id u1))
    (ok vessel-id)
  )
)

;; Update vessel status (active/inactive)
(define-public (update-vessel-status (vessel-id uint) (active bool))
  (let
    (
      (vessel (unwrap! (map-get? vessels { vessel-id: vessel-id }) (err u404)))
    )
    (asserts! (is-eq tx-sender (get owner vessel)) (err u401))
    (map-set vessels
      { vessel-id: vessel-id }
      (merge vessel { active: active })
    )
    (ok true)
  )
)

;; Check if vessel exists and is active
(define-read-only (is-vessel-active (vessel-id uint))
  (match (map-get? vessels { vessel-id: vessel-id })
    vessel (is-eq (get active vessel) true)
    false
  )
)

;; Get vessel details
(define-read-only (get-vessel-details (vessel-id uint))
  (map-get? vessels { vessel-id: vessel-id })
)

;; Get vessel owner
(define-read-only (get-vessel-owner (vessel-id uint))
  (match (map-get? vessels { vessel-id: vessel-id })
    vessel (some (get owner vessel))
    none
  )
)

