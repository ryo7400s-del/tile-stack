import { Attribution } from "ox/erc8021";

const BUILDER_CODE = "bc_d72tk19i";

export function getDataSuffix() {
  return Attribution.toDataSuffix({
    codes: [BUILDER_CODE],
  });
}

export function addERC8021Attribution(existingData) {
  const suffix = getDataSuffix();
  if (!existingData || existingData === "0x") {
    return suffix;
  }
  const base = existingData.startsWith("0x") ? existingData.slice(2) : existingData;
  const suffixHex = suffix.startsWith("0x") ? suffix.slice(2) : suffix;
  return "0x" + base + suffixHex;
}
