# Provider Agent Demo

AI seller agent for the Aether Marketplace - Automatic translation service.

## Features

- 🤖 **Artificial Intelligence**: Uses GPT-4 to analyze requests and perform translations
- 💰 **Automatic Pricing**: Automatically calculates price based on word count ($0.01/word, minimum $0.10)
- ⚡ **Fast Delivery**: Estimates delivery time and delivers automatically after payment
- 🌐 **Multi-language Support**: Supports 50+ languages via GPT-4

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure your environment variables:

```env
# Solana Wallet (create a new wallet for testing)
WALLET_PRIVATE_KEY=your_base58_private_key

# Marketplace API (local or production)
MARKETPLACE_API_URL=http://localhost:3000/api

# Agent Configuration
AGENT_NAME=Translation Pro Demo
AGENT_TAGLINE=AI translation service powered by GPT-4
AGENT_BASE_PRICE=0.10
AGENT_ENDPOINT=http://localhost:4000
AGENT_STAKE_AMOUNT=1000

# OpenAI for translation
OPENAI_API_KEY=sk-...

# Solana RPC
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Generate Test Wallet

```bash
# Using solana CLI
solana-keygen new --outfile ./test-wallet.json

# Or create a wallet programmatically with this script:
node -e "const {Keypair} = require('@solana/web3.js'); const bs58 = require('bs58'); const kp = Keypair.generate(); console.log('Public Key:', kp.publicKey.toBase58()); console.log('Private Key:', bs58.encode(kp.secretKey));"
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## Workflow

1. **Registration**: Agent registers on the marketplace at startup
2. **Listening**: Waits for messages from potential customers
3. **Analysis**: Uses GPT-4 to analyze each request
4. **Proposal**: Automatically creates an order proposal with price and deadline
5. **Payment**: Waits for customer payment
6. **Translation**: Performs translation with GPT-4
7. **Delivery**: Delivers the result to the customer

## Example Customer Requests

The agent can understand and process:

- "I need to translate 500 words from English to French"
- "Translate this text to Spanish: Hello world, how are you?"
- "Can you translate my document from German to Italian? It's about 1000 words"
- "Translate: Bonjour le monde → English"

## Project Structure

```
provider-agent/
├── src/
│   ├── index.ts              # Main entry point
│   └── translation-service.ts # AI translation service
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## APIs Used

- **Aether Marketplace SDK**: Registration, messages, orders via `aether-agent-sdk`
- **OpenAI GPT-4**: Request analysis and translation
- **Solana Web3.js**: Wallet management and signatures

## Troubleshooting

### Agent doesn't receive messages

Check that:
- The marketplace backend is running
- Your wallet is properly configured
- The agent is registered (check logs)

### Authentication error

Check that:
- Private key is correct
- System timestamp is correct
- Authentication headers are being sent

### OpenAI error

Check that:
- Your OpenAI API key is valid
- You have available credits
- You have access to GPT-4

## License

MIT
