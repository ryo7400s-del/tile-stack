import { useState, useEffect, useRef, useCallback } from "react";

const CANVAS_W = 360;
const CANVAS_H = 540;
const BASE_H = 30;
const TILE_H = 26;
const SPEED_INIT = 2.2;
const SPEED_INC = 0.18;

const TILE_GRADIENTS = [
  ["#FF6B6B", "#FF1744"],
  ["#FF9A3C", "#FF6D00"],
  ["#FFE033", "#FFB300"],
  ["#69FF47", "#00C853"],
  ["#18FFFF", "#00B8D4"],
  ["#448AFF", "#2962FF"],
  ["#E040FB", "#AA00FF"],
  ["#FF4081", "#C51162"],
  ["#64FFDA", "#1DE9B6"],
  ["#EEFF41", "#C6FF00"],
  ["#FF6E40", "#DD2C00"],
  ["#40C4FF", "#0091EA"],
];

const CONTRACT_ADDRESS = "0xc1b52710776230Cb22c5709Ea06Ce1901B4Db56B";

function pickGrad(idx) { return TILE_GRADIENTS[idx % TILE_GRADIENTS.length]; }

const STARS = Array.from({ length: 60 }, () => ({
  x: Math.random() * CANVAS_W,
  y: Math.random() * CANVAS_H,
  r: Math.random() * 1.2 + 0.3,
  a: Math.random(),
}));

// ABI encode: submitScore(uint256 score, string nickname)
function encodeSubmitScore(score, nickname) {
  const selector = "0x643270c5"; // keccak256("submitScore(uint256,string)") first 4 bytes
  const scoreHex = BigInt(score).toString(16).padStart(64, "0");
  const offsetHex = (64).toString(16).padStart(64, "0"); // offset to string = 0x40
  const nicknameBytes = new TextEncoder().encode(nickname);
  const lengthHex = nicknameBytes.length.toString(16).padStart(64, "0");
  const paddedLen = Math.ceil(nicknameBytes.length / 32) * 32;
  const dataHex = Array.from(nicknameBytes)
    .map(b => b.toString(16).padStart(2, "0")).join("")
    .padEnd(paddedLen * 2, "0");
  return selector + scoreHex + offsetHex + lengthHex + dataHex;
}

export default function TileStackGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const bgTickRef = useRef(0);

  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [bestLocal, setBestLocal] = useState(0);
  const [walletAddr, setWalletAddr] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [nickname, setNickname] = useState("");

  const drawTile = useCallback((ctx, x, y, w, h, gradColors, alpha = 1) => {
    if (w <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, gradColors[0]);
    g.addColorStop(1, gradColors[1]);
    ctx.shadowColor = gradColors[0];
    ctx.shadowBlur = 20;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    const shine = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    shine.addColorStop(0, "rgba(255,255,255,0.45)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 3, w - 8, h * 0.45, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x + 3, y + 4, 3, h - 8);
    ctx.restore();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    if (!s) return;

    bgTickRef.current += 0.004;
    const t = bgTickRef.current;

    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    grad.addColorStop(0, `hsl(${(t * 30) % 360},70%,8%)`);
    grad.addColorStop(0.5, `hsl(${(t * 30 + 120) % 360},60%,10%)`);
    grad.addColorStop(1, `hsl(${(t * 30 + 240) % 360},70%,7%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    STARS.forEach(star => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${star.a * 0.6 + Math.sin(t * 3 + star.x) * 0.2})`;
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }

    s.stack.forEach((tile, i) => {
      const y = CANVAS_H - BASE_H - (i + 1) * TILE_H;
      drawTile(ctx, tile.x, y, tile.w, TILE_H, tile.grad, 1.0);
    });

    const baseGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    baseGrad.addColorStop(0, "#FF6B6B");
    baseGrad.addColorStop(0.2, "#FFC93C");
    baseGrad.addColorStop(0.4, "#6BCB77");
    baseGrad.addColorStop(0.6, "#4D96FF");
    baseGrad.addColorStop(0.8, "#C77DFF");
    baseGrad.addColorStop(1, "#FF6B6B");
    ctx.save();
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.roundRect(2, CANVAS_H - BASE_H + 2, CANVAS_W - 4, BASE_H - 4, 6);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("✦ BASE ✦", CANVAS_W / 2, CANVAS_H - BASE_H / 2 + 4);

    if (s.moving) {
      const mt = s.moving;
      const y = CANVAS_H - BASE_H - (s.stack.length + 1) * TILE_H;
      drawTile(ctx, mt.x, y, mt.w, TILE_H, mt.grad, 0.95);
      const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("▼ TAP ▼", CANVAS_W / 2, y - 9);
    }

    ctx.save();
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`✦ ${s.stack.length}`, 14, 40);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,220,100,0.7)";
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillText(`BEST  ${s.best}`, 14, 60);
    ctx.restore();
  }, [drawTile]);

  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.phase !== "playing") return;
    const mt = s.moving;
    mt.x += mt.dir * mt.speed;
    const ref = s.stack.length > 0 ? s.stack[s.stack.length - 1] : { x: 0, w: CANVAS_W };
    if (mt.x < ref.x - mt.w) { mt.x = ref.x - mt.w; mt.dir = 1; }
    if (mt.x + mt.w > ref.x + ref.w + mt.w) { mt.x = ref.x + ref.w; mt.dir = -1; }
    draw();
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  const placeTile = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.phase !== "playing") return;
    const mt = s.moving;
    const prev = s.stack.length > 0 ? s.stack[s.stack.length - 1] : { x: 0, w: CANVAS_W };
    const overlapLeft = Math.max(prev.x, mt.x);
    const overlapRight = Math.min(prev.x + prev.w, mt.x + mt.w);
    const overlapW = overlapRight - overlapLeft;

    if (overlapW <= 0) {
      s.phase = "over";
      cancelAnimationFrame(rafRef.current);
      draw();
      const finalScore = s.stack.length;
      setBestLocal(b => Math.max(b, finalScore));
      setScore(finalScore);
      setPhase("over");
      return;
    }

    s.stack.push({ x: overlapLeft, w: overlapW, grad: mt.grad });
    const nextIdx = s.stack.length;
    const nextDir = nextIdx % 2 === 0 ? 1 : -1;
    s.moving = {
      x: nextDir === 1 ? -overlapW : CANVAS_W,
      w: overlapW,
      dir: nextDir,
      speed: Math.min(SPEED_INIT + nextIdx * SPEED_INC, 9),
      grad: pickGrad(nextIdx),
    };
  }, [draw]);

  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stateRef.current = {
      phase: "playing",
      stack: [],
      best: bestLocal,
      moving: { x: -80, w: CANVAS_W * 0.55, dir: 1, speed: SPEED_INIT, grad: pickGrad(0) },
    };
    setTxStatus("");
    setPhase("playing");
    setScore(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, bestLocal]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); if (phase === "playing") placeTile(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, placeTile]);

  useEffect(() => {
    if (phase !== "idle") return;
    let raf;
    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      bgTickRef.current += 0.004;
      const t = bgTickRef.current;
      const g = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      g.addColorStop(0, `hsl(${(t * 30) % 360},70%,8%)`);
      g.addColorStop(1, `hsl(${(t * 30 + 180) % 360},60%,10%)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      STARS.forEach(star => {
        ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.a * 0.5 + Math.sin(t * 3 + star.x) * 0.2})`; ctx.fill();
      });
      [{ x: 40, w: 280 }, { x: 55, w: 250 }, { x: 70, w: 210 }, { x: 90, w: 165 }, { x: 110, w: 120 }].forEach((tile, i) => {
        const y = CANVAS_H - BASE_H - (i + 1) * TILE_H;
        const tg = ctx.createLinearGradient(tile.x, y, tile.x, y + TILE_H);
        tg.addColorStop(0, pickGrad(i + 2)[0]); tg.addColorStop(1, pickGrad(i + 2)[1]);
        ctx.save(); ctx.shadowColor = pickGrad(i + 2)[0]; ctx.shadowBlur = 18;
        ctx.fillStyle = tg; ctx.beginPath();
        ctx.roundRect(tile.x + 2, y + 2, tile.w - 4, TILE_H - 4, 5); ctx.fill(); ctx.restore();
      });
      const bg = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
      bg.addColorStop(0, "#FF6B6B"); bg.addColorStop(0.5, "#4D96FF"); bg.addColorStop(1, "#C77DFF");
      ctx.fillStyle = bg; ctx.beginPath();
      ctx.roundRect(2, CANVAS_H - BASE_H + 2, CANVAS_W - 4, BASE_H - 4, 6); ctx.fill();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const connectWallet = async () => {
    if (!window.ethereum) { alert("MetaMaskが見つかりません"); return; }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setWalletAddr(accounts[0]);
  };

  const submitOnChain = async () => {
    if (!walletAddr) { await connectWallet(); return; }
    if (!nickname.trim()) { alert("ニックネームを入力してください"); return; }
    setTxStatus("pending");
    try {
      const data = encodeSubmitScore(score, nickname.trim());
      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddr, to: CONTRACT_ADDRESS, data, gas: "0x80000" }],
      });
      setTxStatus("done");
    } catch (e) { console.error(e); setTxStatus("error"); }
  };

  const isPlaying = phase === "playing";
  const isOver = phase === "over";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#050510 0%,#0d0520 50%,#100515 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New',monospace", color: "#fff", padding: "16px",
    }}>
      <div style={{ marginBottom: 14, textAlign: "center" }}>
        <div style={{
          fontSize: 30, fontWeight: "900", letterSpacing: "0.2em",
          background: "linear-gradient(90deg,#FF6B6B,#FFC93C,#69FF47,#4D96FF,#E040FB,#FF6B6B)",
          backgroundSize: "200%",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          textTransform: "uppercase",
          filter: "drop-shadow(0 0 14px rgba(200,130,255,0.5))",
        }}>✦ TILE STACK ✦</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.35em", marginTop: 3 }}>
          ON-CHAIN LEADERBOARD EDITION
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          style={{
            display: "block", borderRadius: 14,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 0 60px rgba(100,150,255,0.3), 0 0 120px rgba(200,100,255,0.15)",
            cursor: isPlaying ? "pointer" : "default",
          }}
          onClick={() => isPlaying && placeTile()}
        />

        {phase === "idle" && (
          <div style={overlayStyle}>
            <div style={{ fontSize: 40, marginBottom: 6, filter: "drop-shadow(0 0 18px rgba(255,200,60,0.9))" }}>🏆</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>タイルを重ねて高さを競え</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
              ズレた部分はカット → 完全ミスでゲームオーバー
            </div>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value.slice(0, 12))}
              placeholder="ニックネーム (任意)"
              maxLength={12}
              style={inputStyle}
            />
            <button style={glowBtn("#4D96FF", "#7B61FF")} onClick={startGame}>▶  START GAME</button>
          </div>
        )}

        {isOver && (
          <div style={overlayStyle}>
            <div style={{
              fontSize: 14, letterSpacing: "0.25em", marginBottom: 6,
              background: "linear-gradient(90deg,#FF6B6B,#FF1744)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 8px #FF1744aa)",
            }}>★ GAME OVER ★</div>
            <div style={{
              fontSize: 64, fontWeight: 900, lineHeight: 1, marginBottom: 2,
              background: "linear-gradient(180deg,#fff 0%,#FFD700 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 22px rgba(255,215,0,0.7))",
            }}>{score}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, letterSpacing: "0.15em" }}>TILES STACKED</div>
            <div style={{
              fontSize: 13, marginBottom: 16,
              background: "linear-gradient(90deg,#FFC93C,#FF8E53)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>✦ BEST &nbsp;{bestLocal}</div>

            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 16,
              width: "100%", maxWidth: 240, textAlign: "center",
            }}>
              <div style={{
                fontSize: 10, letterSpacing: "0.2em", marginBottom: 10,
                background: "linear-gradient(90deg,#4CC9F0,#4D96FF)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>⛓ ON-CHAIN SUBMIT</div>

              <input
                value={nickname}
                onChange={e => setNickname(e.target.value.slice(0, 12))}
                placeholder="ニックネーム"
                maxLength={12}
                style={{ ...inputStyle, marginBottom: 8, width: "100%", boxSizing: "border-box" }}
              />

              {walletAddr
                ? <div style={{ fontSize: 10, color: "#4CC9F0", marginBottom: 8 }}>{walletAddr.slice(0, 6)}…{walletAddr.slice(-4)} ✓</div>
                : <button style={{ ...glowBtn("#6BCB77", "#00C853"), marginBottom: 8, fontSize: 11, padding: "6px 16px" }} onClick={connectWallet}>
                  🦊 Wallet 接続
                </button>
              }
              {walletAddr && (
                <button
                  style={glowBtn(
                    txStatus === "done" ? "#6BCB77" : txStatus === "error" ? "#FF6B6B" : "#C77DFF",
                    txStatus === "done" ? "#00C853" : txStatus === "error" ? "#FF1744" : "#7B00FF",
                  )}
                  onClick={submitOnChain}
                  disabled={txStatus === "pending" || txStatus === "done"}
                >
                  {txStatus === "" && "スコアを登録 🚀"}
                  {txStatus === "pending" && "⏳ 送信中…"}
                  {txStatus === "done" && "✓ 登録済み！"}
                  {txStatus === "error" && "× 失敗 再試行"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={glowBtn("#4D96FF", "#2962FF")} onClick={startGame}>🔄 RETRY</button>
            </div>
          </div>
        )}
      </div>

      {isPlaying && (
        <div style={{
          marginTop: 10, fontSize: 11, letterSpacing: "0.12em",
          background: "linear-gradient(90deg,rgba(77,150,255,0.7),rgba(199,125,255,0.7))",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>タップ / クリック / スペース で DROP</div>
      )}
    </div>
  );
}

const overlayStyle = {
  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  background: "rgba(5,3,18,0.86)", backdropFilter: "blur(6px)",
  borderRadius: 14, color: "#fff", textAlign: "center", padding: 22,
};

const inputStyle = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 6,
  color: "#fff",
  fontFamily: "'Courier New',monospace",
  fontSize: 13,
  padding: "8px 12px",
  marginBottom: 14,
  outline: "none",
  textAlign: "center",
  width: "180px",
};

function glowBtn(c1, c2) {
  return {
    background: `linear-gradient(135deg,${c1},${c2})`,
    border: "none", borderRadius: 8, color: "#fff",
    fontFamily: "'Courier New',monospace", fontWeight: "bold", fontSize: 13,
    letterSpacing: "0.1em", padding: "10px 22px", cursor: "pointer",
    boxShadow: `0 0 22px ${c1}66, 0 2px 8px rgba(0,0,0,0.4)`,
    transition: "transform 0.1s",
  };
  }
