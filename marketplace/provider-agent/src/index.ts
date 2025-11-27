import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { MarketplaceProvider } from 'aether-agent-sdk/marketplace';
import { TranslationService } from './translation-service';

dotenv.config();

async function main() {
  console.log('🚀 Starting Provider Agent Demo...\n');

  // Load wallet
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('WALLET_PRIVATE_KEY not found in .env');
  }

  const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
  console.log(`✅ Wallet loaded: ${wallet.publicKey.toBase58()}\n`);

  // Initialize translation service
  const translationService = new TranslationService(
    process.env.OPENAI_API_KEY!
  );

  // Create provider with SDK
  const provider = new MarketplaceProvider({
    apiUrl: process.env.MARKETPLACE_API_URL!,
    wallet: wallet,
    profile: {
      name: process.env.AGENT_NAME!,
      tagline: process.env.AGENT_TAGLINE!,
      description: process.env.AGENT_DESCRIPTION!,
      categories: process.env.AGENT_CATEGORIES!.split(','),
      basePrice: parseFloat(process.env.AGENT_BASE_PRICE!),
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=translation'
    },
    services: [
      {
        title: 'Document Translation',
        description: 'Professional AI-powered translation service supporting 50+ languages',
        price: 0.10,
        deliveryTime: 10, // minutes
        examples: [
          'Translate 500 words from English to French',
          'Translate technical document from German to Spanish',
          'Translate marketing copy from Japanese to English'
        ]
      },
      {
        title: 'Quick Translation (< 100 words)',
        description: 'Fast translation for short texts, phrases, or sentences',
        price: 0.05,
        deliveryTime: 3,
        examples: [
          'Translate email subject line',
          'Translate product description',
          'Translate social media post'
        ]
      }
    ]
  });

  // Register on marketplace (or connect to existing agent)
  console.log('📝 Connecting to marketplace...');
  await provider.register({
    endpoint: process.env.AGENT_ENDPOINT!,
    stakeAmount: parseFloat(process.env.AGENT_STAKE_AMOUNT!)
  });
  console.log('✅ Connected to marketplace!\n');

  // Handle incoming messages
  provider.onMessage(async (conversation, message) => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💬 New message in conversation ${conversation.id}`);
    console.log(`   From: ${message.from}`);
    console.log(`   Message: "${message.message}"\n`);

    try {
      // Analyze request with AI
      console.log('🤖 Analyzing request with GPT-4...');
      const analysis = await translationService.analyzeRequest(message.message);

      console.log(`\n📊 Analysis Results:`);
      console.log(`   Can Handle: ${analysis.canHandle ? '✅ Yes' : '❌ No'}`);
      console.log(`   Task: ${analysis.task}`);
      console.log(`   Source Language: ${analysis.sourceLang}`);
      console.log(`   Target Language: ${analysis.targetLang}`);
      console.log(`   Word Count: ${analysis.wordCount}`);
      console.log(`   Estimated Price: $${analysis.price} USDC`);
      console.log(`   Delivery Time: ${analysis.deliveryTime} minutes\n`);

      if (analysis.canHandle) {
        // Create order proposal
        console.log('📋 Creating order proposal...');
        const result = await provider.createOrder(conversation.id, {
          description: analysis.orderDescription,
          originalRequest: analysis.sourceText || message.message, // Store original text for translation
          price: analysis.price,
          deliveryTime: analysis.deliveryTime
        });

        console.log(`✅ Order proposal created: ${result.orderId}`);
        console.log(`   Waiting for customer to accept and pay...`);
      } else {
        // Send decline message
        console.log('❌ Cannot handle this request');
        await provider.reply(
          conversation.id,
          analysis.declineReason || "I'm sorry, I can only handle translation requests. Please describe what text you'd like translated and to which language."
        );
        console.log('📤 Decline message sent');
      }
    } catch (error: any) {
      console.error('\n❌ Error handling message:', error.message);
      try {
        await provider.reply(
          conversation.id,
          "I'm sorry, I encountered an error processing your request. Please try rephrasing your request or contact support."
        );
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });

  // Handle paid orders
  provider.onOrderPaid(async (order) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`💰 ORDER PAID! 💰`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Order ID: ${order.id}`);
    console.log(`Amount: $${order.price * 0.9} USDC (90% of ${order.price})`);
    console.log(`Transaction: ${order.escrowTx || 'pending'}\n`);

    try {
      // Use original request if available, otherwise parse description
      const textToAnalyze = order.originalRequest || order.description;
      console.log('🔍 Parsing order details...');
      const analysis = await translationService.analyzeRequest(textToAnalyze);

      console.log(`\n🔄 Starting translation work...`);
      console.log(`   From: ${analysis.sourceLang}`);
      console.log(`   To: ${analysis.targetLang}`);
      console.log(`   Words: ${analysis.wordCount}\n`);

      // Use original request for translation, fallback to extracted text or description
      const textToTranslate = order.originalRequest || analysis.sourceText || order.description;

      // Perform translation using GPT-4
      const translatedText = await translationService.translate(
        textToTranslate,
        analysis.sourceLang,
        analysis.targetLang
      );

      console.log(`✅ Translation completed!`);
      console.log(`   Result length: ${translatedText.length} characters\n`);

      // Deliver result
      console.log('📦 Delivering result to customer...');
      await provider.deliver(order.id, {
        result: translatedText,
        message: `✅ Translation completed successfully!\n\nFrom: ${analysis.sourceLang}\nTo: ${analysis.targetLang}\n\nThank you for your order! If you need any revisions, please let me know.`,
        attachments: []
      });

      console.log(`✅ Delivery submitted successfully!`);
      console.log(`${'='.repeat(50)}\n`);
    } catch (error: any) {
      console.error(`\n❌ Error delivering order:`, error.message);
      console.log(`${'='.repeat(50)}\n`);

      // Try to notify customer of the error
      try {
        await provider.deliver(order.id, {
          result: 'Error occurred during translation. Refund will be processed.',
          message: `I'm sorry, but I encountered an error while processing your translation: ${error.message}. Please contact support for a refund.`,
          attachments: []
        });
      } catch (deliveryError) {
        console.error('Failed to send error delivery:', deliveryError);
      }
    }
  });

  // Start listening for events
  console.log('👂 Starting marketplace event listener...');
  provider.start(3000); // Poll every 3 seconds
  console.log('✅ Provider agent is running!\n');

  console.log('━'.repeat(50));
  console.log('🎯 Agent is now online and ready for customers!');
  console.log('━'.repeat(50));
  console.log('\nAgent Details:');
  console.log(`  Name: ${process.env.AGENT_NAME}`);
  console.log(`  Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`  Base Price: $${process.env.AGENT_BASE_PRICE} USDC`);
  console.log(`  Categories: ${process.env.AGENT_CATEGORIES}`);
  console.log('\nWaiting for customers...\n');

  // Keep process running
  process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down provider agent...');
    provider.stop();
    console.log('✅ Agent stopped cleanly');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
