;; Catch Reporting Contract
;; Tracks fish harvested by species and location

;; Define data variables
(define-data-var next-catch-id uint u1)
(define-map catches
  { catch-id: uint }
  {
    vessel-id: uint,
    species: (string-utf8 30),
    amount: uint,
    location: {
      latitude: int,
      longitude: int
    },
    timestamp: uint,
    verified: bool
  }
)

;; Report a new catch
(define-public (report-catch
    (vessel-id uint)
    (species (string-utf8 30))
    (amount uint)
    (latitude int)
    (longitude int))
  (let
    (
      (catch-id (var-get next-catch-id))
    )
    ;; Record the catch
    (map-set catches
      { catch-id: catch-id }
      {
        vessel-id: vessel-id,
        species: species,
        amount: amount,
        location: {
          latitude: latitude,
          longitude: longitude
        },
        timestamp: block-height,
        verified: false
      }
    )
    (var-set next-catch-id (+ catch-id u1))
    (ok catch-id)
  )
)

;; Verify a catch (by authorized verifier)
(define-public (verify-catch (catch-id uint))
  (let
    (
      (catch (unwrap! (map-get? catches { catch-id: catch-id }) (err u404)))
    )
    ;; Only authorized verifiers can verify catches
    (asserts! (is-authorized-verifier tx-sender) (err u401))

    ;; Update the catch verification status
    (map-set catches
      { catch-id: catch-id }
      (merge catch { verified: true })
    )
    (ok true)
  )
)

;; Get catch details
(define-read-only (get-catch-details (catch-id uint))
  (map-get? catches { catch-id: catch-id })
)

;; Check if catch is verified
(define-read-only (is-catch-verified (catch-id uint))
  (match (map-get? catches { catch-id: catch-id })
    catch (get verified catch)
    false
  )
)

;; Authorized verifiers
(define-map authorized-verifiers principal bool)

;; Add authorized verifier (only contract owner)
(define-public (add-authorized-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err u401))
    (map-set authorized-verifiers verifier true)
    (ok true)
  )
)

;; Check if principal is authorized verifier
(define-read-only (is-authorized-verifier (verifier principal))
  (default-to false (map-get? authorized-verifiers verifier))
)

;; Contract owner
(define-constant contract-owner tx-sender)

