
const normalizeAsset = (asset) => {
  if (!asset) return null;
  const uppercaseAsset = asset.toUpperCase().trim();
  const aliasMap = {
    BITCOIN: 'BTC',
    ETHEREUM: 'ETH',
    SOLANA: 'SOL',
    TETHER: 'USDT',
    // add more if needed
  };
  return aliasMap[uppercaseAsset] || uppercaseAsset;
};

const normalizeType = (type) => {
  if (!type) return 'UNKNOWN';
  const uppercaseType = type.toUpperCase().trim();

  if (['DEPOSIT', 'TRANSFER_IN', 'IN'].includes(uppercaseType)) return 'TRANSFER_IN';
  if (['WITHDRAWAL', 'TRANSFER_OUT', 'OUT'].includes(uppercaseType)) return 'TRANSFER_OUT';
  if (['BUY'].includes(uppercaseType)) return 'BUY';
  if (['SELL'].includes(uppercaseType)) return 'SELL';
  if (['TRADE', 'SWAP'].includes(uppercaseType)) return 'TRADE';

  return uppercaseType;
};

module.exports = {
  normalizeAsset,
  normalizeType,
};
