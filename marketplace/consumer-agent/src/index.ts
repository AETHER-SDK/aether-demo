import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { MarketplaceConsumer } from 'aether-agent-sdk/marketplace';
import { TaskAnalyzer } from './task-analyzer';

dotenv.config();

async function main() {
  console.log('🤖 Starting Consumer Agent Demo...\n');

  // Load wallet
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('WALLET_PRIVATE_KEY not found in .env');
  }

  const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
  console.log(`✅ Wallet loaded: ${wallet.publicKey.toBase58()}\n`);

  // Initialize task analyzer (GPT-4)
  const taskAnalyzer = new TaskAnalyzer(process.env.OPENAI_API_KEY!);

  // Create consumer with SDK
  const consumer = new MarketplaceConsumer({
    apiUrl: process.env.MARKETPLACE_API_URL!,
    wallet: wallet
  });

  // Initialize settlement agent
  console.log('🔧 Initializing settlement agent...');
  await consumer.init();
  console.log('✅ Settlement agent ready\n');

  // Get task from environment
  const task = process.env.AGENT_TASK || "Translate 'Hello world' to French";

  console.log('='.repeat(50));
  console.log('🎯 TASK TO ACCOMPLISH:');
  console.log(`   "${task}"`);
  console.log('='.repeat(50));
  console.log();

  // Step 1: Analyze task to determine what kind of agent we need
  console.log('🧠 Analyzing task with GPT-4...');
  const analysis = await taskAnalyzer.analyzeTask(task);

  console.log('\n📊 Task Analysis:');
  console.log(`   Category: ${analysis.category}`);
  console.log(`   Max Budget: $${analysis.maxBudget} USDC`);
  console.log(`   Keywords: ${analysis.keywords.join(', ')}`);
  console.log(`   Requirements: ${analysis.requirements}\n`);

  // Step 2: Search for agents that match
  console.log(`🔍 Searching for ${analysis.category} agents...`);
  const agents = await consumer.search({
    category: analysis.category,
    maxPrice: analysis.maxBudget
  });

  console.log(`\n✅ Found ${agents.length} agents matching criteria\n`);

  if (agents.length === 0) {
    console.log('❌ No agents found. Exiting...');
    process.exit(0);
  }

  // Display agents
  console.log('📋 Available Agents:');
  agents.slice(0, 5).forEach((agent, index) => {
    console.log(`\n${index + 1}. ${agent.name}`);
    console.log(`   ${agent.tagline}`);
    console.log(`   Base Price: $${agent.basePrice} | Rating: ${agent.rating || 'N/A'} ⭐`);
    console.log(`   Orders: ${agent.totalOrders || 0} | Categories: ${agent.categories.join(', ')}`);
  });

  // Select best agent (first one for demo)
  const selectedAgent = agents[0];
  console.log(`\n\n✨ Selected: ${selectedAgent.name}`);
  console.log(`${'='.repeat(50)}\n`);

  // Step 3: Start conversation
  console.log(`💬 Starting conversation with ${selectedAgent.name}...`);
  const conversation = await consumer.startConversation(selectedAgent.id, {
    message: task
  });

  console.log(`✅ Conversation started: ${conversation.id}\n`);
  console.log(`💭 Sent message: "${task}"`);
  console.log(`\n⏳ Waiting for agent response...\n`);

  // Listen for messages
  conversation.on('message', async (msg) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📨 New Message from ${selectedAgent.name}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Message: "${msg.message}"\n`);

    // Check if there's an order proposal
    if (msg.hasOrder && msg.order) {
      console.log(`📋 ORDER PROPOSAL RECEIVED:`);
      console.log(`   ID: ${msg.order.id}`);
      console.log(`   Description: ${msg.order.description}`);
      console.log(`   Price: $${msg.order.price} USDC`);
      console.log(`   Delivery Time: ${msg.order.deliveryTime} minutes\n`);

      // Use GPT-4 to decide whether to accept
      console.log(`🤔 Evaluating order proposal with AI...`);
      const shouldAccept = await taskAnalyzer.shouldAcceptOrder(
        task,
        msg.order.description,
        msg.order.price,
        analysis.maxBudget
      );

      if (shouldAccept.accept) {
        console.log(`✅ AI Decision: ACCEPT`);
        console.log(`   Reason: ${shouldAccept.reason}\n`);

        // Accept and pay
        console.log(`💳 Accepting order and creating payment...`);
        try {
          const receipt = await conversation.acceptOrder(msg.order.id!, {
            paymentMethod: 'usdc'
          });

          console.log(`\n✅ PAYMENT SUCCESSFUL!`);
          console.log(`   Transaction: ${receipt.transactionSignature}`);
          console.log(`\n⏳ Waiting for delivery...\n`);
        } catch (error: any) {
          console.error(`\n❌ Payment failed:`, error.message);
          console.log(`Trying to send message to agent...\n`);
          await conversation.send(`Sorry, payment failed: ${error.message}`);
        }
      } else {
        console.log(`❌ AI Decision: DECLINE`);
        console.log(`   Reason: ${shouldAccept.reason}\n`);

        // Send counter-offer or decline
        if (shouldAccept.counterOffer) {
          console.log(`💬 Sending counter-offer: $${shouldAccept.counterOffer}\n`);
          await conversation.send(
            `Can you do it for $${shouldAccept.counterOffer} instead? ${shouldAccept.reason}`
          );
        } else {
          console.log(`📤 Declining order\n`);
          await conversation.send(`I'm declining this order. ${shouldAccept.reason}`);
        }
      }
    }
  });

  // Listen for delivery
  conversation.on('delivery', async (delivery) => {
    console.log(`\n${'🎉'.repeat(25)}`);
    console.log(`DELIVERY RECEIVED!`);
    console.log(`${'🎉'.repeat(25)}\n`);

    console.log(`Order ID: ${delivery.orderId}`);
    console.log(`Message: ${delivery.message}\n`);
    console.log('='.repeat(50));
    console.log('RESULT:');
    console.log('='.repeat(50));
    console.log(delivery.result);
    console.log('='.repeat(50) + '\n');

    if (delivery.attachments && delivery.attachments.length > 0) {
      console.log(`📎 Attachments:`);
      delivery.attachments.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
      console.log();
    }

    // Use GPT-4 to evaluate quality and generate review
    console.log(`🤖 Evaluating delivery quality with AI...`);
    const review = await taskAnalyzer.generateReview(
      task,
      delivery.result,
      delivery.message || ''
    );

    console.log(`\n⭐ AI Review:`);
    console.log(`   Rating: ${review.rating}/5 ${'⭐'.repeat(review.rating)}`);
    console.log(`   Comment: "${review.comment}"\n`);

    // Submit review
    console.log(`📝 Submitting review...`);
    await conversation.review(delivery.orderId, {
      rating: review.rating,
      comment: review.comment
    });

    console.log(`✅ Review submitted!\n`);

    console.log(`${'='.repeat(50)}`);
    console.log(`🎊 TASK COMPLETED SUCCESSFULLY! 🎊`);
    console.log(`${'='.repeat(50)}\n`);

    // Stop listening and exit
    conversation.stop();
    process.exit(0);
  });

  // Keep process running
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down consumer agent...');
    conversation.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
