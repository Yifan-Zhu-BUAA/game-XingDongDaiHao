/**
 * Socket.io 集成测试 - 模拟 2/3/4 人真实游戏流程
 * 运行: node test-integration.cjs
 * 
 * 事件API:
 *   room:join    -> (roomId, playerName, cb(success, error))
 *   seat:take    -> (seatIndex, cb(success, error))
 *   config:update-> ({maxPlayers}, cb(success, error))
 *   game:start   -> (cb(success, error))
 *   clue:give    -> (word, number, cb(success, error))
 *   card:guess   -> (cardIndex, cb(success, error))  // result via 'guess:result' event
 *   turn:end     -> (cb(success, error))
 *   game:state   -> server push event with full state
 */

const { io } = require('socket.io-client');

const SERVER = 'http://localhost:3000';
let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.log(`  ❌ ${msg}`); failed++; }
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const sock = io(SERVER, { 
      auth: { clientId: 'test-' + name + '-' + Date.now() },
      forceNew: true,
    });
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', (e) => reject(new Error('connect failed: ' + e.message)));
    setTimeout(() => reject(new Error('connect timeout')), 5000);
  });
}

function emitCb(sock, event, ...args) {
  return new Promise((resolve) => {
    sock.emit(event, ...args, (...cbArgs) => resolve(cbArgs));
  });
}

// 等待 game:state 事件获取最新状态
function waitForState(sock) {
  return new Promise((resolve) => {
    sock.once('game:state', (state) => resolve(state));
  });
}

// 等待 guess:result 事件
function waitForGuessResult(sock) {
  return new Promise((resolve) => {
    sock.once('guess:result', (result) => resolve(result));
  });
}

// ==========================================
// 测试A: 2人模式完整流程
// ==========================================
async function test2PlayerMode() {
  console.log('\n🎮 集成测试A: 2人模式完整流程');

  const p1 = await connect('Alice');
  const p2 = await connect('Bob');

  const roomId = 'test2p' + Date.now().toString(36);
  
  const [s1, e1] = await emitCb(p1, 'room:join', roomId, 'Alice');
  assert(s1, `Alice加入房间 ${roomId}`);
  await wait(100);

  const [s2, e2] = await emitCb(p2, 'room:join', roomId, 'Bob');
  assert(s2, 'Bob加入房间');
  await wait(100);

  // 设置为2人模式
  const [s3, e3] = await emitCb(p1, 'config:update', { maxPlayers: 2 });
  assert(s3, '设置2人模式');
  await wait(100);

  // 入座
  const [s4] = await emitCb(p1, 'seat:take', 0);
  assert(s4, 'Alice坐座位0');
  await wait(50);
  const [s5] = await emitCb(p2, 'seat:take', 1);
  assert(s5, 'Bob坐座位1');
  await wait(100);

  // 开始
  const statePromise = waitForState(p1);
  const [s6, e6] = await emitCb(p1, 'game:start');
  assert(s6, `游戏开始 ${e6 || ''}`);
  
  let state = await statePromise;
  assert(state.phase === 'playing', `状态=playing (${state.phase})`);
  assert(state.currentTeam === 'red', `先手红队 (${state.currentTeam})`);

  const alice = state.players.find(p => p.name === 'Alice');
  const bob = state.players.find(p => p.name === 'Bob');
  assert(alice.team === 'red' && alice.isSpymaster, 'Alice=红队队长');
  assert(bob.team === 'red' && !bob.isSpymaster, 'Bob=红队猜词者');

  // 给线索
  const sp1 = waitForState(p2);
  const [clueOk] = await emitCb(p1, 'clue:give', '测试', 1);
  assert(clueOk, '线索已发');
  state = await sp1;

  // 结束回合 → 自动翻蓝牌
  const sp2 = waitForState(p1);
  const [s7] = await emitCb(p2, 'turn:end');
  assert(s7, '结束回合');
  state = await sp2;

  assert(state.currentTeam === 'red', `回合后仍红队 (${state.currentTeam})`);
  assert(state.blueScore >= 1, `蓝队自动得分>=1 (${state.blueScore})`);
  console.log(`  ℹ️  自动翻牌: blue ${state.blueScore}/${state.blueTotal}`);

  // 第二轮：给线索 → 猜红牌 → 继续
  const sp3 = waitForState(p2);
  await emitCb(p1, 'clue:give', '继续', 2);
  state = await sp3;

  const redCard = state.cards.find(c => c.type === 'red' && !c.revealed);
  if (redCard) {
    const grPromise = waitForGuessResult(p2);
    const sp4 = waitForState(p1);
    const [gs] = await emitCb(p2, 'card:guess', redCard.id);
    assert(gs, '猜红牌成功');
    
    const gr = await grPromise;
    assert(gr.continueTurn === true, '猜中红牌继续回合');
    assert(gr.gameEnded === false, '游戏未结束');
    state = await sp4;
    assert(state.currentTeam === 'red', '仍红队回合');
  }

  p1.disconnect(); p2.disconnect();
  console.log('  🏁 2人模式测试完成');
}

// ==========================================
// 测试B: 3人模式完整流程
// ==========================================
async function test3PlayerMode() {
  console.log('\n🎮 集成测试B: 3人模式完整流程');

  const p1 = await connect('Dan');
  const p2 = await connect('Eve');
  const p3 = await connect('Frank');

  const roomId = 'test3p' + Date.now().toString(36);

  await emitCb(p1, 'room:join', roomId, 'Dan');
  await wait(50);
  await emitCb(p2, 'room:join', roomId, 'Eve');
  await wait(50);
  await emitCb(p3, 'room:join', roomId, 'Frank');
  await wait(50);

  // 设置3人模式
  await emitCb(p1, 'config:update', { maxPlayers: 3 });
  await wait(50);

  // 入座
  await emitCb(p1, 'seat:take', 0);
  await wait(50);
  await emitCb(p2, 'seat:take', 1);
  await wait(50);
  await emitCb(p3, 'seat:take', 2);
  await wait(50);

  // 开始
  const sp = waitForState(p1);
  const [s1, e1] = await emitCb(p1, 'game:start');
  assert(s1, `3人游戏开始 ${e1 || ''}`);
  let state = await sp;

  const dan = state.players.find(p => p.name === 'Dan');
  const eve = state.players.find(p => p.name === 'Eve');
  const frank = state.players.find(p => p.name === 'Frank');

  assert(dan.team === 'red' && dan.isSpymaster, 'Dan=红队长');
  assert(eve.team === 'blue' && eve.isSpymaster, 'Eve=蓝队长');
  assert(frank.isDoubleAgent === true, 'Frank=双面间谍 ✨');
  assert(frank.isSpymaster === false, 'Frank非队长');

  const firstTeam = state.currentTeam;
  const spySocket = firstTeam === 'red' ? p1 : p2;

  // 先手队长给线索
  const sp2 = waitForState(p3);
  const [clueOk] = await emitCb(spySocket, 'clue:give', '双面', 1);
  assert(clueOk, '线索已发');
  state = await sp2;

  // 双面间谍猜先手队颜色的牌
  const targetCard = state.cards.find(c => c.type === firstTeam && !c.revealed);
  if (targetCard) {
    const grPromise = waitForGuessResult(p3);
    const sp3 = waitForState(p1);
    const [gs] = await emitCb(p3, 'card:guess', targetCard.id);
    assert(gs, `双面间谍猜${firstTeam}牌成功`);
    
    const gr = await grPromise;
    assert(gr.continueTurn === true, `猜中${firstTeam}牌继续`);
    state = await sp3;
  }

  // 双面间谍结束回合 → 切到对方
  const otherTeam = firstTeam === 'red' ? 'blue' : 'red';
  const sp4 = waitForState(p1);
  const [s2] = await emitCb(p3, 'turn:end');
  assert(s2, '双面间谍结束回合');
  state = await sp4;
  assert(state.currentTeam === otherTeam, `切到${otherTeam}队 (${state.currentTeam})`);

  // 另一队队长给线索 → 双面间谍猜牌
  const otherSpySocket = otherTeam === 'red' ? p1 : p2;
  const sp5 = waitForState(p3);
  await emitCb(otherSpySocket, 'clue:give', '另一面', 1);
  state = await sp5;

  const otherCard = state.cards.find(c => c.type === otherTeam && !c.revealed);
  if (otherCard) {
    const grPromise = waitForGuessResult(p3);
    const sp6 = waitForState(p1);
    const [gs] = await emitCb(p3, 'card:guess', otherCard.id);
    assert(gs, `双面间谍在${otherTeam}回合猜牌成功`);
    
    const gr = await grPromise;
    assert(gr.continueTurn === true, `猜中${otherTeam}牌继续`);
  }

  p1.disconnect(); p2.disconnect(); p3.disconnect();
  console.log('  🏁 3人模式测试完成');
}

// ==========================================
// 测试C: 4人标准模式回归
// ==========================================
async function test4PlayerMode() {
  console.log('\n🎮 集成测试C: 4人标准模式回归');

  const names = ['W1', 'W2', 'W3', 'W4'];
  const socks = [];
  for (const n of names) socks.push(await connect(n));

  const roomId = 'test4p' + Date.now().toString(36);

  for (let i = 0; i < 4; i++) {
    await emitCb(socks[i], 'room:join', roomId, names[i]);
    await wait(50);
  }

  for (let i = 0; i < 4; i++) {
    await emitCb(socks[i], 'seat:take', i);
    await wait(50);
  }

  const sp1 = waitForState(socks[0]);
  const [s1] = await emitCb(socks[0], 'game:start');
  assert(s1, '4人游戏开始');
  let state = await sp1;

  assert(state.players.every(p => !p.isDoubleAgent), '4人无双面间谍');

  const firstTeam = state.currentTeam;
  const otherTeam = firstTeam === 'red' ? 'blue' : 'red';
  const spymasterIdx = firstTeam === 'red' ? 0 : 1;
  const guesserIdx = firstTeam === 'red' ? 2 : 3;

  const sp2 = waitForState(socks[guesserIdx]);
  await emitCb(socks[spymasterIdx], 'clue:give', '标准', 1);
  await sp2;

  const sp3 = waitForState(socks[0]);
  const [s2] = await emitCb(socks[guesserIdx], 'turn:end');
  assert(s2, '结束回合');
  state = await sp3;
  assert(state.currentTeam === otherTeam, `4人正常切到${otherTeam} (${state.currentTeam})`);

  socks.forEach(s => s.disconnect());
  console.log('  🏁 4人标准模式测试完成');
}

// ==========================================
// 主测试流程
// ==========================================
async function main() {
  console.log('🚀 开始 Socket.io 集成测试...\n');

  try {
    await test2PlayerMode();
    await wait(300);
    await test3PlayerMode();
    await wait(300);
    await test4PlayerMode();
  } catch (err) {
    console.error('\n💥 测试异常:', err.message);
    console.error(err.stack);
    failed++;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 集成测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
  if (failed > 0) {
    console.log('⚠️  有失败的测试！');
  } else {
    console.log('🎉 全部通过！');
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
