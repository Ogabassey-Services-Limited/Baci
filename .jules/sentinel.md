
## 2025-03-02 - Replace weak random number generation with cryptographically secure alternatives
**Vulnerability:** Found `Math.random` being used to generate identifier codes such as file names, redemption codes, referral codes and event identifiers. `Math.random` is NOT cryptographically secure, predictable, and should never be used for things that require collision resistance or an element of security.
**Learning:** Avoid using `Math.random` for any code, ID, password, or security token generation since it uses a pseudorandom number generator with a deterministic algorithm.
**Prevention:** For web contexts, use `crypto.randomUUID()` or `crypto.getRandomValues()`. They provide cryptographically secure values suitable for generation of unique numbers and tokens.
