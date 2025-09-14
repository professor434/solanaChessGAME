# Deployment Guide - Solana Chess Game

## Quick Deployment Steps

### 1. Build the Project
```bash
pnpm install
pnpm run build
```

### 2. Deploy to Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 3. Switch to Mainnet
Update `src/lib/real-wallet-integration.ts`:
```typescript
// Change from 'devnet' to 'mainnet-beta'
constructor(network: 'devnet' | 'mainnet-beta' = 'mainnet-beta') {
```

## Mainnet Configuration

### Treasury Wallet Setup
1. Create a new Solana wallet for treasury
2. Update the treasury address in `src/lib/real-wallet-integration.ts`:
```typescript
private treasuryWallet = new PublicKey('YOUR_MAINNET_TREASURY_WALLET');
```

### Network Configuration
```typescript
// In real-wallet-integration.ts
export class RealSolanaIntegration {
  constructor(network: 'devnet' | 'mainnet-beta' = 'mainnet-beta') {
    this.network = network;
    const endpoint = network === 'devnet' 
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com';
    
    this.connection = new Connection(endpoint, 'confirmed');
  }
}
```

## Environment Variables

Create `.env.local`:
```env
VITE_SOLANA_NETWORK=mainnet-beta
VITE_TREASURY_WALLET=YOUR_TREASURY_WALLET_ADDRESS
```

## Deployment Platforms

### Vercel (Recommended)
```bash
vercel --prod
```

### Netlify
1. Build: `pnpm run build`
2. Upload `dist` folder to Netlify

### AWS S3 + CloudFront
1. Build: `pnpm run build`
2. Upload `dist` to S3 bucket
3. Configure CloudFront distribution

### GitHub Pages
1. Build: `pnpm run build`
2. Push `dist` contents to `gh-pages` branch

## Security Checklist

- [ ] Treasury wallet is secure and backed up
- [ ] Network is set to mainnet-beta
- [ ] SSL certificate is configured
- [ ] Domain is configured properly
- [ ] Test with small amounts first

## Testing on Mainnet

1. **Start Small**: Test with 0.001 SOL entrance fees
2. **Verify Transactions**: Check all transactions on Solscan
3. **Test Wallet Connections**: Ensure all major wallets work
4. **Monitor Performance**: Check for any network issues

## Monitoring

### Transaction Monitoring
- Use Solscan.io to monitor treasury wallet
- Set up alerts for large transactions
- Monitor for failed transactions

### Error Tracking
- Set up Sentry or similar error tracking
- Monitor console errors
- Track user feedback

## Maintenance

### Regular Updates
- Monitor Solana network updates
- Update dependencies regularly
- Test new wallet adapter versions

### Backup Strategy
- Regular backup of treasury wallet
- Keep deployment scripts updated
- Document all configuration changes

## Performance Optimization

### Bundle Optimization
```bash
# Analyze bundle
pnpm run build --analyze

# Optimize chunks
# Already configured in vite.config.ts
```

### CDN Configuration
- Use CDN for static assets
- Enable gzip compression
- Set proper cache headers

## Legal Considerations

### Terms of Service
- Add terms of service page
- Include gambling disclaimers if required
- Specify jurisdiction and applicable laws

### Compliance
- Check local gambling laws
- Consider KYC requirements for large amounts
- Implement responsible gaming features

## Support Setup

### User Support
- Create FAQ page
- Set up support email
- Document common issues

### Developer Support
- API documentation
- Integration guides
- Community Discord/Telegram

---

## Final Checklist Before Mainnet

- [ ] All tests pass
- [ ] Treasury wallet configured
- [ ] Network set to mainnet
- [ ] SSL certificate active
- [ ] Terms of service added
- [ ] Support channels ready
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Small amount testing completed
- [ ] Legal compliance verified

**Your Solana Chess game is ready for mainnet! 🚀**