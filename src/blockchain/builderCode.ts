/**
 * Base Builder Codes via ERC-8021 attribution suffix (Schema 0).
 *
 * Spec (parsed backwards from end of calldata):
 *
 *   TX_DATA + [codes: ASCII, comma-delimited] + [codesLength: 1 byte] +
 *             [schemaId: 1 byte = 0x00] + [ercMarker: 16 bytes = 0x80218021×8]
 *
 * The codesLength byte sits IMMEDIATELY before the schemaId byte so a reader
 * that scans backwards from the end (marker → schemaId → codesLength → codes)
 * can locate it without already knowing the codes length. Putting it at the
 * start of the suffix makes the reader interpret the last byte of `codes` as
 * codesLength and grab the calldata before the suffix as the codes field.
 *
 * The CDP v2 SDK's `sendUserOperation` accepts this as the `dataSuffix`
 * parameter and appends it to the UserOperation callData.
 *
 * Example for code "bc_rpsrjjtz" (11 ASCII bytes):
 *   0x  62635f727073726a6a747a    ("bc_rpsrjjtz")
 *       0b                        (codesLength = 11)
 *       00                        (schemaId = canonical code registry)
 *       80218021802180218021802180218021  (16-byte ercMarker)
 *
 * References:
 *   https://eip.tools/eip/8021
 *   https://blog.base.dev/builder-codes-and-erc-8021-fixing-onchain-attribution
 *   https://docs.base.org/base-chain/builder-codes/builder-codes
 */

const ERC_8021_MARKER = "80218021802180218021802180218021"; // 16 bytes
const SCHEMA_ID_REGISTRY = "00"; // Schema 0: canonical code registry

export function getBuilderCode(): string {
  return (process.env.BASE_BUILDER_CODE ?? "").trim();
}

/**
 * Returns the full ERC-8021 attribution suffix as a 0x-prefixed hex string.
 * Returns "0x" if no builder code is configured.
 *
 * Pass directly to CDP's sendUserOperation({ dataSuffix }).
 */
export function getBuilderDataSuffix(): `0x${string}` {
  const code = getBuilderCode();
  if (!code) return "0x";

  // codes field: comma-delimited ASCII (we have one code → no comma).
  const codesBytes = Buffer.from(code, "ascii");
  const codesLength = codesBytes.length;
  if (codesLength > 0xff) {
    throw new Error(
      `BASE_BUILDER_CODE too long (${codesLength} bytes; max 255)`,
    );
  }

  const codesLengthHex = codesLength.toString(16).padStart(2, "0");
  const codesHex = codesBytes.toString("hex");

  return `0x${codesHex}${codesLengthHex}${SCHEMA_ID_REGISTRY}${ERC_8021_MARKER}` as `0x${string}`;
}

/** Legacy helper kept for non-UserOp paths — appends suffix to bare calldata. */
export function withBuilderCode(calldata: `0x${string}`): `0x${string}` {
  const suffix = getBuilderDataSuffix();
  if (suffix === "0x") return calldata;
  return (calldata + suffix.slice(2)) as `0x${string}`;
}
