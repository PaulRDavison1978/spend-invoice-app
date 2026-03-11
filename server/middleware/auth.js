import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import prisma from '../lib/prisma.js';

const jwksClient = jwksRsa({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
});

function getSigningKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Auth middleware that validates Microsoft MSAL JWT tokens.
 * Extracts oid + tid claims, looks up user by azure_oid.
 * Sets req.user and req.userPermissions.
 */
export default function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // In development, allow a bypass token format: "dev:<email>"
  if (process.env.NODE_ENV !== 'production' && token.startsWith('dev:')) {
    return handleDevToken(token, req, res, next);
  }

  const clientId = process.env.AZURE_AD_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'AZURE_AD_CLIENT_ID not configured' });
  }

  jwt.verify(token, getSigningKey, {
    algorithms: ['RS256'],
    audience: [`api://${clientId}`, clientId],
    // Multi-tenant: we validate issuer per-token below
  }, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token', ...(process.env.NODE_ENV !== 'production' && { details: err.message }) });
    }

    // Validate issuer matches the tenant ID in the token (v1 or v2 format)
    const tid = decoded.tid;
    const validIssuers = [
      `https://login.microsoftonline.com/${tid}/v2.0`,
      `https://sts.windows.net/${tid}/`,
    ];
    if (!validIssuers.includes(decoded.iss)) {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }

    try {
      await attachUser(decoded.oid, decoded.tid, req, res, next);
    } catch (dbErr) {
      next(dbErr);
    }
  });
}

async function handleDevToken(token, req, res, next) {
  const email = token.substring(4).toLowerCase(); // strip "dev:"
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!user || user.status !== 'Active') {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    req.userPermissions = user.role.permissions.map(rp => rp.permission.key);
    next();
  } catch (err) {
    next(err);
  }
}

async function attachUser(oid, tid, req, res, next) {
  const user = await prisma.user.findUnique({
    where: { azureOid: oid },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  if (!user) {
    return res.status(403).json({ error: 'User not registered. Contact an administrator.' });
  }

  if (user.status === 'Removed' || user.status === 'Anonymized') {
    return res.status(403).json({ error: 'Account has been deactivated' });
  }

  req.user = user;
  req.userPermissions = user.role.permissions.map(rp => rp.permission.key);
  next();
}
