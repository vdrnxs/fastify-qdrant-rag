/**
 * Script para probar el endpoint de chat
 * Uso: npx tsx scripts/test-chat.ts
 */

async function testChat() {
  const baseUrl = 'http://localhost:3000';

  console.log('🧪 Testing Chat Endpoint\n');

  // Test 1: Simple question
  console.log('Test 1: Simple question');
  const response1 = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '¿Qué es Docker?'
    })
  });

  const result1 = await response1.json();
  console.log('Response:', JSON.stringify(result1, null, 2));
  console.log('\n' + '─'.repeat(60) + '\n');

  // Test 2: Question with conversation history
  console.log('Test 2: Question with history');
  const response2 = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '¿Cómo se instala?',
      history: [
        { role: 'user', content: '¿Qué es Docker?' },
        { role: 'assistant', content: result1.data?.response || 'Docker es una plataforma...' }
      ]
    })
  });

  const result2 = await response2.json();
  console.log('Response:', JSON.stringify(result2, null, 2));
  console.log('\n' + '─'.repeat(60) + '\n');

  // Test 3: Custom system prompt
  console.log('Test 3: Custom system prompt');
  const response3 = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Explica Docker',
      systemPrompt: 'Eres un experto en DevOps. Responde de forma técnica y detallada.',
      maxContextDocs: 5
    })
  });

  const result3 = await response3.json();
  console.log('Response:', JSON.stringify(result3, null, 2));

  console.log('\n✅ All tests completed!');
}

testChat().catch(console.error);