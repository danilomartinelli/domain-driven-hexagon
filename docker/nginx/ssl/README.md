# SSL Certificates for Nginx

This directory contains SSL certificates and keys used by the Nginx reverse proxy.

## Contents

- `cert.pem` - SSL certificate
- `key.pem` - Private key
- `dhparam.pem` - Diffie-Hellman parameters for perfect forward secrecy

## Generating Certificates

### Development (Self-signed)

```bash
# Run the SSL generation script
make ssl

# Or manually:
cd docker/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=BR/ST=State/L=City/O=DDH/CN=localhost"

# Generate DH parameters
openssl dhparam -out dhparam.pem 2048
```

### Production

For production, replace the self-signed certificates with certificates from a trusted CA:

1. **Let's Encrypt** (recommended):

   ```bash
   # Install certbot
   apt install certbot

   # Generate certificates
   certbot certonly --standalone -d yourdomain.com

   # Copy to nginx ssl directory
   cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem cert.pem
   cp /etc/letsencrypt/live/yourdomain.com/privkey.pem key.pem
   ```

2. **Commercial Certificate Authority**:
   - Purchase SSL certificate from a CA
   - Place certificate chain in `cert.pem`
   - Place private key in `key.pem`

## Security Notes

- **Never commit private keys to version control**
- Keys should have restricted permissions (600)
- Certificates should be renewed before expiration
- Use strong Diffie-Hellman parameters (2048 bits minimum)

## File Permissions

Ensure proper file permissions:

```bash
chmod 600 key.pem
chmod 644 cert.pem
chmod 644 dhparam.pem
```
