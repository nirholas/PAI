import { ed25519 } from '@noble/curves/ed25519.js';
import { base58 } from '@scure/base';
import { createPublicClient, getAddress, http, isAddress, recoverMessageAddress, type Chain } from 'viem';
import { arbitrum, base, baseSepolia, bsc, mainnet, optimism, polygon, sepolia } from 'viem/chains';
import { createSiweMessage, generateSiweNonce } from 'viem/siwe';

import { HttpError } from './http';

export type ChainKind = 'evm' | 'sol';

const CHAINS: Record<number, Chain> = Object.fromEntries(
  [mainnet, base, baseSepolia, sepolia, bsc, polygon, arbitrum, optimism].map((c) => [c.id, c]),
);
const NONCE_TTL_MS = 10 * 60 * 1000;

export interface Challenge {
  address: string;
  chain: ChainKind;
  chainId: number | null;
  expiresAt: number;
  message: string;
  nonce: string;
}

export function buildChallenge(opts: {
  address: string;
  chain: ChainKind;
  chainId?: number;
  origin: string;
  statement: string;
}): Challenge {
  const url = new URL(opts.origin);
  const nonce = generateSiweNonce();
  const issuedAt = new Date();
  const expirationTime = new Date(issuedAt.getTime() + NONCE_TTL_MS);
  if (opts.chain === 'evm') {
    if (!isAddress(opts.address, { strict: false })) throw new HttpError(400, 'Invalid EVM address');
    const chainId = Number.isInteger(opts.chainId) && opts.chainId! > 0 ? opts.chainId! : 1;
    const address = getAddress(opts.address);
    const message = createSiweMessage({
      address,
      chainId,
      domain: url.host,
      expirationTime,
      issuedAt,
      nonce,
      statement: opts.statement,
      uri: url.origin,
      version: '1',
    });
    return { address, chain: 'evm', chainId, expiresAt: expirationTime.getTime(), message, nonce };
  }
  let pk: Uint8Array;
  try {
    pk = base58.decode(opts.address);
  } catch {
    throw new HttpError(400, 'Invalid Solana address');
  }
  if (pk.length !== 32) throw new HttpError(400, 'Invalid Solana address');
  const message = [
    `${url.host} wants you to sign in with your Solana account:`,
    opts.address,
    '',
    opts.statement,
    '',
    `URI: ${url.origin}`,
    'Version: 1',
    'Chain ID: mainnet',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expirationTime.toISOString()}`,
  ].join('\n');
  return { address: opts.address, chain: 'sol', chainId: null, expiresAt: expirationTime.getTime(), message, nonce };
}

/** Verifies a signature over the exact challenge text the server issued. EOAs by ecrecover, smart accounts by ERC-1271/6492. */
export async function verifyChallenge(c: Pick<Challenge, 'address' | 'chain' | 'chainId' | 'message'>, signature: string) {
  if (c.chain === 'evm') {
    if (!/^0x[0-9a-fA-F]+$/.test(signature)) throw new HttpError(400, 'Malformed signature');
    const sig = signature as `0x${string}`;
    const address = c.address as `0x${string}`;
    if (sig.length === 132) {
      const recovered = await recoverMessageAddress({ message: c.message, signature: sig }).catch(() => null);
      if (recovered && recovered.toLowerCase() === address.toLowerCase()) return;
    }
    const chain = CHAINS[c.chainId ?? 1] ?? mainnet;
    const client = createPublicClient({ chain, transport: http() });
    const ok = await client.verifyMessage({ address, message: c.message, signature: sig }).catch(() => false);
    if (!ok) throw new HttpError(401, 'Signature does not match the wallet address');
    return;
  }
  let sig: Uint8Array;
  try {
    sig = Uint8Array.from(atob(signature), (ch) => ch.charCodeAt(0));
  } catch {
    throw new HttpError(400, 'Malformed signature');
  }
  const ok = sig.length === 64 && ed25519.verify(sig, new TextEncoder().encode(c.message), base58.decode(c.address));
  if (!ok) throw new HttpError(401, 'Signature does not match the wallet address');
}
