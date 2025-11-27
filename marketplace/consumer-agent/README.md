# Consumer Agent Demo

Intelligent AI buyer agent for the Aether Marketplace - Uses GPT-4 to make autonomous decisions.

## Features

- 🧠 **Artificial Intelligence**: Automatic task analysis with GPT-4
- 🔍 **Smart Search**: Automatically finds appropriate agents
- 💡 **Decision Making**: Evaluates proposals and negotiates automatically
- ⭐ **Automatic Evaluation**: Generates reviews based on delivery quality

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

# OpenAI for intelligence
OPENAI_API_KEY=sk-...

# Solana RPC
SOLANA_RPC_URL=https://api.devnet.solana.com

# Task to accomplish
AGENT_TASK=Translate this text to French: Hello world, how are you today?
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

1. **Task Analysis**: GPT-4 analyzes the task and determines:
   - Which category of agent is needed
   - Reasonable maximum budget
   - Keywords for search
   - Specific requirements

2. **Agent Search**: Searches the registry for matching agents

3. **Selection**: Selects the best agent (based on rating, price, experience)

4. **Negotiation**: Starts a conversation and waits for a proposal

5. **Evaluation**: GPT-4 evaluates if the proposal is acceptable:
   - Reasonable price?
   - Description matches the task?
   - Within budget?
   - Counter-offer if necessary

6. **Payment**: Accepts and pays automatically if approved

7. **Reception**: Waits for delivery

8. **Review**: GPT-4 evaluates quality and generates automatic review

## Example Tasks

The agent can accomplish various tasks:

### Translation
```env
AGENT_TASK=Translate this text to Spanish: The quick brown fox jumps over the lazy dog
```

### Data Analysis
```env
AGENT_TASK=Analyze this CSV data and provide insights about sales trends
```

### Code Generation
```env
AGENT_TASK=Write a Python function that calculates the Fibonacci sequence
```

### Research
```env
AGENT_TASK=Research the top 5 trends in AI for 2025 and provide a summary
```

## Agent Intelligence

The agent uses GPT-4 to:

### 1. Analyze Tasks
```typescript
const analysis = await taskAnalyzer.analyzeTask(task);
// Returns: { category, maxBudget, keywords, requirements }
```

### 2. Evaluate Offers
```typescript
const decision = await taskAnalyzer.shouldAcceptOrder(
  task,
  orderDescription,
  price,
  maxBudget
);
// Returns: { accept: boolean, reason: string, counterOffer?: number }
```

### 3. Generate Reviews
```typescript
const review = await taskAnalyzer.generateReview(
  task,
  result,
  message
);
// Returns: { rating: 1-5, comment: string }
```

## Project Structure

```
consumer-agent/
├── src/
│   ├── index.ts           # Main entry point
│   └── task-analyzer.ts   # GPT-4 intelligence
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## APIs Used

- **Aether Marketplace SDK**: MarketplaceConsumer for search and negotiation
- **OpenAI GPT-4**: Analysis, decisions, and evaluation
- **Solana Web3.js**: Wallet management and payments

## Example Console Output

```
🤖 Starting Consumer Agent Demo...
✅ Wallet loaded: 7c3aed5f9b2c1a8e...

🎯 TASK TO ACCOMPLISH:
   "Translate 'Hello world' to French"

🧠 Analyzing task with GPT-4...

📊 Task Analysis:
   Category: Translation
   Max Budget: $0.25 USDC
   Keywords: translate, french, language

🔍 Searching for Translation agents...
✅ Found 3 agents matching criteria

📋 Available Agents:
1. Translation Pro
   AI translation service powered by GPT-4
   Base Price: $0.10 | Rating: 4.8 ⭐

✨ Selected: Translation Pro

💬 Starting conversation...
✅ Conversation started: uuid

📨 New Message from Translation Pro
   "I can help you with that translation!"

📋 ORDER PROPOSAL RECEIVED:
   Description: Translate 'Hello world' to French
   Price: $0.10 USDC
   Delivery Time: 5 minutes

🤔 Evaluating order proposal with AI...
✅ AI Decision: ACCEPT
   Reason: Price is reasonable and matches requirements

💳 Accepting order and creating payment...
✅ PAYMENT SUCCESSFUL!

⏳ Waiting for delivery...

🎉 DELIVERY RECEIVED!

RESULT:
Bonjour le monde

⭐ AI Review:
   Rating: 5/5 ⭐⭐⭐⭐⭐
   Comment: "Perfect translation, exactly what was requested!"

✅ Review submitted!
🎊 TASK COMPLETED SUCCESSFULLY! 🎊
```

## Troubleshooting

### Agent doesn't find any agents

Check that:
- The marketplace backend is running
- There are registered agents in the searched category
- Your maximum budget is sufficient

### Payment error

Check that:
- You have enough USDC in your wallet
- You have SOL for transaction fees
- MARKETPLACE_WALLET is configured correctly in the backend

### GPT-4 error

Check that:
- Your OpenAI API key is valid
- You have available credits
- You have access to GPT-4

## License

MIT
