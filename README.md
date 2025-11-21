# Aether Demo - AI Weather Agents with x402 Payments

Demonstration of autonomous AI agents using the [Aether Agent SDK](https://github.com/4n0nn43x/Aether) for payment-enabled agent-to-agent communication on Solana.

---

## Overview

This demo showcases two implementations of a weather service marketplace:

1. **Simple Agents** - Basic HTTP implementation without payments
2. **Aether Agents** - Full x402 payment protocol with Solana USDC settlements

### Use Case

**Weather Service Marketplace:**
- **Agent A (Weather Provider)** - Sells weather data for cities worldwide
- **Agent B (Customer)** - Purchases weather data on behalf of users

---

## Architecture Comparison

### Simple Agents (No Payments)

```
User → Customer Agent → Weather Agent → External API
         (Free)           (Free)
```

**Files:**
- `weather-agent.js` - Basic weather service
- `consumer-agent.js` - Simple HTTP client

**Limitations:**
- No monetization
- No access control
- No payment verification

### Aether Agents (x402 Payments)

```
User → Customer Agent → Weather Agent → External API
         ↓ Payment          ↓ Verification
         USDC Transfer      Settlement
         (Solana)           (Blockchain)
```

**Files:**
- `weather-agent-aether.js` - x402-enabled weather service
- `customer-agent-aether.js` - Payment-capable customer agent

**Features:**
- ✅ x402 payment protocol
- ✅ Solana USDC settlements
- ✅ Blockchain verification
- ✅ AI-powered extraction
- ✅ Autonomous payments

---

## Quick Start

### Prerequisites

- Node.js 18+
- Solana wallet with devnet SOL and USDC
- OpenAI API key

### Installation

```bash
npm install
```

### Environment Setup

Create `.env`:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# Solana Network
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# Agent A (Weather Provider - Seller)
AGENT_A_WALLET_ADDRESS=your_wallet_address
AGENT_A_PRIVATE_KEY=your_base58_private_key

# Agent B (Customer - Buyer)
AGENT_B_WALLET_ADDRESS=buyer_wallet_address
AGENT_B_PRIVATE_KEY=buyer_base58_private_key

# USDC Token
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Pricing
WEATHER_PRICE_USDC=0.10
```

### Get Devnet Funds

```bash
# Get SOL for transaction fees
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet

# Get USDC (use Circle faucet or community faucets)
```

---

## Running the Demo

### Option 1: Simple Agents (No Payments)

**Terminal 1 - Weather Service:**
```bash
node weather-agent.js
```

**Terminal 2 - Customer:**
```bash
node consumer-agent.js
```

**Test:**
```bash
curl http://localhost:4000/weather?city=Paris
```

### Option 2: Aether Agents (With Payments)

**Terminal 1 - Weather Provider:**
```bash
node weather-agent-aether.js
```

**Terminal 2 - Customer Agent:**
```bash
node customer-agent-aether.js
```

**Test:**
```bash
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in Paris?", "sessionId": "user123"}'
```

---

## Payment Flow (Aether Agents)

### Step 1: Initial Request
```
Customer → Weather Provider: GET /weather?city=Paris
```

### Step 2: Payment Required (402)
```json
{
  "error": "Payment Required",
  "price": {
    "amount": 0.1,
    "currency": "USDC"
  },
  "requirements": {
    "scheme": "exact",
    "network": "solana-devnet",
    "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "payTo": "782SHSv5vP9hCsjcmCyZPedhSGW39y2b6h6ncdN4J8cN",
    "maxAmountRequired": "100000"
  }
}
```

### Step 3: Create Signed Payment
```javascript
const paymentHeader = await settlementAgent.createSignedPayment(
  'weather_provider_address',
  0.1
)
```

### Step 4: Submit Payment
```
Customer → Weather Provider: GET /weather?city=Paris
Headers: X-Payment-Header: [signed_transaction_base64]
```

### Step 5: Verification & Settlement
- Provider verifies payment structure
- Provider submits transaction to Solana
- Transaction confirmed (~400ms)
- Weather data returned

### Step 6: Response
```json
{
  "location": "Paris, France",
  "weather": {
    "temperature": 15.2,
    "windspeed": 12.5,
    "weathercode": 0
  },
  "payment": {
    "verified": true,
    "txHash": "8kYTUoD7r7aUm...",
    "amount": 0.1,
    "currency": "USDC"
  }
}
```

---

## Key Differences

| Feature | Simple Agents | Aether Agents |
|---------|--------------|---------------|
| **Payment** | None | USDC on Solana |
| **Protocol** | HTTP | HTTP + x402 |
| **Settlement** | N/A | ~400ms blockchain |
| **Cost** | Free | $0.00025/tx + service fee |
| **Verification** | None | Blockchain proof |
| **Monetization** | No | Yes |
| **AI Integration** | Basic | Advanced (OpenAI) |
| **Access Control** | No | Payment-gated |

---

## Technical Implementation

### Weather Provider (Agent A)

**Responsibilities:**
1. Receive weather requests
2. Return 402 if no payment
3. Verify payment headers
4. Submit transactions to Solana
5. Return weather data after confirmation

**Key Code:**
```javascript
const { X402FacilitatorServer } = require('aether-agent-sdk')

const facilitator = new X402FacilitatorServer()

// Verify payment
const verification = await facilitator.verify(paymentHeader, requirements)

// Submit transaction
const settlement = await facilitator.settle(paymentHeader, requirements)

// Return data
res.json({ weather: data, payment: { txHash: settlement.txHash } })
```

### Customer Agent (Agent B)

**Responsibilities:**
1. Process user requests
2. Request weather data
3. Create signed payments
4. Submit payments to provider
5. Return results to user

**Key Code:**
```javascript
const { SettlementAgent } = require('aether-agent-sdk')

const agent = new SettlementAgent()
await agent.init()

// Create signed payment
const paymentHeader = await agent.createSignedPayment(
  providerAddress,
  0.1
)

// Send with payment
const response = await axios.get('/weather', {
  headers: { 'X-Payment-Header': paymentHeader }
})
```

---

## API Endpoints

### Weather Provider (Port 3000)

**GET /weather**
- **Query**: `city` (string)
- **Headers**: `X-Payment-Header` (optional)
- **Response**: Weather data or 402 Payment Required

**GET /health**
- Health check and pricing info

**GET /payment-schemes**
- Supported payment methods

### Customer Agent (Port 4000)

**POST /chat**
- **Body**: `{ message, sessionId }`
- **Response**: AI response with weather data

**GET /payment-history**
- View payment transactions

**GET /balance**
- Check wallet balance

---

## Testing Payment Flow

### Manual Test Sequence

1. **Start both agents**
2. **Request without payment:**
   ```bash
   curl http://localhost:3000/weather?city=London
   # Returns 402 Payment Required
   ```

3. **Request via customer agent:**
   ```bash
   curl -X POST http://localhost:4000/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Weather in London?", "sessionId": "test"}'
   # Returns weather data with payment confirmation
   ```

4. **View transaction:**
   ```bash
   curl http://localhost:4000/payment-history
   ```

---

## Troubleshooting

### "Attempt to debit an account but found no record of a prior credit"

**Cause**: Wallet has no SOL or USDC token account not initialized

**Solution**:
```bash
solana airdrop 2 YOUR_ADDRESS --url devnet
```

### "Payment verification failed"

**Cause**: Incorrect network format or missing funds

**Solution**: Check `.env` configuration and wallet balances

### "Agent wallet not initialized"

**Cause**: Invalid `AGENT_PRIVATE_KEY` format

**Solution**: Ensure base58-encoded private key

---

## Cost Analysis

### Simple Agents
- **Operational Cost**: $0
- **Revenue**: $0
- **Scalability**: Limited (no monetization)

### Aether Agents
- **Transaction Fee**: ~$0.00025 SOL
- **Service Fee**: 0.10 USDC per request
- **Settlement Time**: ~400ms
- **Revenue**: Scalable micropayments

---

## Advanced Features

### Payment Caching
Agents cache recent payments to avoid duplicate requests:
```javascript
if (this.paymentCache[city] && Date.now() - cache.timestamp < 60000) {
  return cached data
}
```

### AI-Powered Extraction
Natural language processing for city names:
```javascript
const aiExtraction = await openai.chat.completions.create({
  messages: [{ content: `Extract city from: ${userInput}` }]
})
```

### Session Management
Conversational context preservation across requests

---

## Resources

- **Aether SDK**: https://github.com/4n0nn43x/Aether
- **x402 Protocol**: https://solana.com/x402/what-is-x402
- **Solana Devnet**: https://api.devnet.solana.com

---

## License

MIT
