import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useWalletClient, useSwitchChain, useConnect, useDisconnect } from "wagmi";
import { encodeFunctionData } from "viem";
import { base } from "wagmi/chains";
import { coinbaseWallet, walletConnect, injected } from "wagmi/connectors";
import { addERC8021Attribution } from "./attribution.js";

const CANVAS_W = 360;
const CANVAS_H = 540;
const BASE_H = 30;
const TILE_H = 26;
const SPEED_INIT = 2.2;
const SPEED_INC = 0.18;

const TILE_GRADIENTS = [
  ["#FF6B6B","#FF1744"],["#FF9A3C","#FF6D00"],["#FFE033","#FFB300"],
  ["#69FF47","#00C853"],["#18FFFF","#00B8D4"],["#448AFF","#2962FF"],
  ["#E040FB","#AA00FF"],["#FF4081","#C51162"],["#64FFDA","#1DE9B6"],
  ["#EEFF41","#C6FF00"],["#FF6E40","#DD2C00"],["#40C4FF","#0091EA"],
];

const CONTRACT_ADDRESS = "0xc1b52710776230Cb22c5709Ea06Ce1901B4Db56B";
const CONTRACT_ABI = [{
  name: "submitScore", type: "function", stateMutability: "nonpayable",
  inputs: [{ name: "score", type: "uint256" }, { name: "nickname", type: "string" }],
  outputs: [],
}];

const PROJECT_ID = "50b53d7f5ff3f9833c6d53f7a8d751d3";

function pickGrad(idx) { return TILE_GRADIENTS[idx % TILE_GRADIENTS.length]; }

const STARS = Array.from({ length: 60 }, () => ({
  x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H,
  r: Math.random() * 1.2 + 0.3, a: Math.random(),
}));

function ConnectModal({ onClose }) {
  const { connect } = useConnect();
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0d0520", border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 16, padding: 24, width: 280, textAlign: "center",
      }}>
        <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 20, color: "#fff" }}>
          Select Wallet
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <button style={walletBtn("#4D96FF")}
            onClick={() => { connect({ connector: injected() }); onClose(); }}>
            MetaMask / Brave / Rabby
          </button>
          <button style={walletBtn("#0052FF")}
            onClick={() => { connect({ connector: coinbaseWallet({ appName: "Tile Stack", preference: "all" }) }); onClose(); }}>
            Coinbase Wallet
          </button>
          <button style={walletBtn("#3B99FC")}
            onClick={() => { connect({ connector: walletConnect({ projectId: PROJECT_ID }) }); onClose(); }}>
            WalletConnect
          </button>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", fontSize: 12,
        }}>Cancel</button>
      </div>
    </div>
  );
}

function WalletSection({ score, nickname, setNickname }) {
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient, refetch: refetchWallet } = useWalletClient();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const [txStatus, setTxStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const isWrongNetwork = isConnected && chain?.id !== base.id;

  async function getWallet() {
    if (walletClient) return walletClient;
    const { data } = await refetchWallet();
    return data || null;
  }

  const handleSubmit = async () => {
    if (!nickname.trim()) { alert("Please enter a nickname"); return; }
    setTxStatus("pending");
    try {
      const wc = await getWallet();
      if (!wc) { alert("Please connect wallet"); setTxStatus(""); return; }
      const baseData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: "submitScore",
        args: [BigInt(score), nickname.trim()],
      });
      const data = addERC8021Attribution(baseData);
      await wc.sendTransaction({
        to: CONTRACT_ADDRESS,
        data,
        chain: base,
      });
      setTxStatus("done");
    } catch (e) {
      console.error(e);
      setTxStatus("error");
    }
  };

  return (
    <>
      {showModal && <ConnectModal onClose={() => setShowModal(false)} />}
      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 10, padding: "12px 16px", marginBottom: 16,
        width: "100%", maxWidth: 240, textAlign: "center",
      }}>
        <div style={{
          fontSize: 10, letterSpacing: "0.2em", marginBottom: 10,
          background: "linear-gradient(90deg,#4CC9F0,#4D96FF)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>ON-CHAIN SUBMIT</div>

        <input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 12))}
          placeholder="Nickname" style={inputStyle} />

        {!isConnected ? (
          <button style={glowBtn("#4D96FF", "#7B61FF")} onClick={() => setShowModal(true)}>
            Connect Wallet
          </button>
        ) : isWrongNetwork ? (
          <div>
            <div style={{ fontSize: 11, color: "#FF6B6B", marginBottom: 8 }}>
              Switch to Base network
            </div>
            <button style={glowBtn("#FF6B6B", "#FF1744")}
              onClick={() => switchChain({ chainId: base.id })}
              disabled={isSwitching}>
              {isSwitching ? "Switching..." : "Switch to Base"}
            </button>
          </div>
        ) : txStatus === "done" ? (
          <div style={{ fontSize: 12, color: "#6BCB77" }}>Score registered!</div>
        ) : (
          <div>
            <div style={{ fontSize: 10, color: "#4CC9F0", marginBottom: 8 }}>
              {address.slice(0, 6)}...{address.slice(-4)}
              <span onClick={() => disconnect()}
                style={{ marginLeft: 8, color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 9 }}>
                Disconnect
              </span>
            </div>
            <button
              style={glowBtn(txStatus === "error" ? "#FF6B6B" : "#C77DFF", txStatus === "error" ? "#FF1744" : "#7B00FF")}
              onClick={txStatus === "error" ? () => setTxStatus("") : handleSubmit}
              disabled={txStatus === "pending"}
            >
              {txStatus === "pending" ? "Sending..." : txStatus === "error" ? "Retry" : "Register Score"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function TileStackGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const bgTickRef = useRef(0);

  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [bestLocal, setBestLocal] = useState(0);
  const [nickname, setNickname] = useState("");

  const drawTile = useCallback((ctx, x, y, w, h, gc, alpha = 1) => {
    if (w <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, gc[0]); g.addColorStop(1, gc[1]);
    ctx.shadowColor = gc[0]; ctx.shadowBlur = 20;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 5); ctx.fill();
    ctx.shadowBlur = 0;
    const shine = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    shine.addColorStop(0, "rgba(255,255,255,0.45)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.beginPath(); ctx.roundRect(x + 4, y + 3, w - 8, h * 0.45, 4); ctx.fill();
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
    grad.addColorStop(0, "hsl(" + ((t * 30) % 360) + ",70%,8%)");
    grad.addColorStop(0.5, "hsl(" + ((t * 30 + 120) % 360) + ",60%,10%)");
    grad.addColorStop(1, "hsl(" + ((t * 30 + 240) % 360) + ",70%,7%)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    STARS.forEach(star => {
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255," + (star.a * 0.6 + Math.sin(t * 3 + star.x) * 0.2) + ")";
      ctx.fill();
    });

    s.stack.forEach((tile, i) => {
      drawTile(ctx, tile.x, CANVAS_H - BASE_H - (i + 1) * TILE_H, tile.w, TILE_H, tile.grad);
    });

    const baseGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    baseGrad.addColorStop(0, "#FF6B6B"); baseGrad.addColorStop(0.2, "#FFC93C");
    baseGrad.addColorStop(0.4, "#6BCB77"); baseGrad.addColorStop(0.6, "#4D96FF");
    baseGrad.addColorStop(0.8, "#C77DFF"); baseGrad.addColorStop(1, "#FF6B6B");
    ctx.save(); ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
    ctx.fillStyle = baseGrad;
    ctx.beginPath(); ctx.roundRect(2, CANVAS_H - BASE_H + 2, CANVAS_W - 4, BASE_H - 4, 6); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
    ctx.fillText("BASE", CANVAS_W / 2, CANVAS_H - BASE_H / 2 + 4);

    if (s.moving) {
      const mt = s.moving;
      const y = CANVAS_H - BASE_H - (s.stack.length + 1) * TILE_H;
      drawTile(ctx, mt.x, y, mt.w, TILE_H, mt.grad, 0.95);
      const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.5;
      ctx.fillStyle = "rgba(255,255,255," + pulse + ")";
      ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
      ctx.fillText("TAP", CANVAS_W / 2, y - 9);
    }

    ctx.fillStyle = "#fff"; ctx.font = "bold 26px monospace"; ctx.textAlign = "left";
    ctx.fillText(s.stack.length + " tiles", 14, 40);
    ctx.fillStyle = "rgba(255,220,100,0.7)"; ctx.font = "11px monospace";
    ctx.fillText("BEST " + s.best, 14, 60);
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
    const oL = Math.max(prev.x, mt.x);
    const oR = Math.min(prev.x + prev.w, mt.x + mt.w);
    const oW = oR - oL;
    if (oW <= 0) {
      s.phase = "over"; cancelAnimationFrame(rafRef.current); draw();
      setBestLocal(b => Math.max(b, s.stack.length));
      setScore(s.stack.length); setPhase("over"); return;
    }
    s.stack.push({ x: oL, w: oW, grad: mt.grad });
    const ni = s.stack.length;
    const nd = ni % 2 === 0 ? 1 : -1;
    s.moving = {
      x: nd === 1 ? -oW : CANVAS_W, w: oW, dir: nd,
      speed: Math.min(SPEED_INIT + ni * SPEED_INC, 9), grad: pickGrad(ni),
    };
  }, [draw]);

  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stateRef.current = {
      phase: "playing", stack: [], best: bestLocal,
      moving: { x: -80, w: CANVAS_W * 0.55, dir: 1, speed: SPEED_INIT, grad: pickGrad(0) },
    };
    setPhase("playing"); setScore(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, bestLocal]);

  useEffect(() => {
    const onKey = e => {
      if ((e.code === "Space" || e.key === " ") && phase === "playing") {
        e.preventDefault(); placeTile();
      }
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
      g.addColorStop(0, "hsl(" + ((t * 30) % 360) + ",70%,8%)");
      g.addColorStop(1, "hsl(" + ((t * 30 + 180) % 360) + ",60%,10%)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      STARS.forEach(star => {
        ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255," + (star.a * 0.5 + Math.sin(t * 3 + star.x) * 0.2) + ")";
        ctx.fill();
      });
      [{x:40,w:280},{x:55,w:250},{x:70,w:210},{x:90,w:165},{x:110,w:120}].forEach((tile, i) => {
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#050510 0%,#0d0520 50%,#100515 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace", color: "#fff", padding: "16px",
    }}>
      <div style={{ marginBottom: 14, textAlign: "center" }}>
        <div style={{
          fontSize: 30, fontWeight: "900", letterSpacing: "0.2em",
          background: "linear-gradient(90deg,#FF6B6B,#FFC93C,#69FF47,#4D96FF,#E040FB,#FF6B6B)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 14px rgba(200,130,255,0.5))",
        }}>TILE STACK</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.35em", marginTop: 3 }}>
          ON-CHAIN LEADERBOARD EDITION
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          style={{
            display: "block", borderRadius: 14,
            boxShadow: "0 0 60px rgba(100,150,255,0.3), 0 0 0 1px rgba(255,255,255,0.08)",
            cursor: phase === "playing" ? "pointer" : "default",
          }}
          onClick={() => phase === "playing" && placeTile()}
        />

        {phase === "idle" && (
          <div style={overlayStyle}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>醇</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>
              Stack tiles as high as possible!
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>
              Misaligned parts are cut. Miss = Game Over
            </div>
            <input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 12))}
              placeholder="Nickname" style={inputStyle} />
            <button style={glowBtn("#4D96FF", "#7B61FF")} onClick={startGame}>START GAME</button>
          </div>
        )}

        {phase === "over" && (
          <div style={overlayStyle}>
            <div style={{
              fontSize: 14, letterSpacing: "0.25em", marginBottom: 6,
              background: "linear-gradient(90deg,#FF6B6B,#FF1744)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>GAME OVER</div>
            <div style={{
              fontSize: 64, fontWeight: 900, lineHeight: 1, marginBottom: 2,
              background: "linear-gradient(180deg,#fff,#FFD700)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 20px rgba(255,215,0,0.7))",
            }}>{score}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TILES STACKED</div>
            <div style={{ fontSize: 13, color: "#FFC93C", marginBottom: 16 }}>BEST {bestLocal}</div>
            <WalletSection score={score} nickname={nickname} setNickname={setNickname} />
            <button style={glowBtn("#4D96FF", "#2962FF")} onClick={startGame}>RETRY</button>
          </div>
        )}
      </div>

      {phase === "playing" && (
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          Tap / Click / Space to DROP
        </div>
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
  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 6, color: "#fff", fontFamily: "monospace", fontSize: 13,
  padding: "8px 12px", marginBottom: 14, outline: "none", textAlign: "center", width: "180px",
};

function walletBtn(color) {
  return {
    background: "rgba(255,255,255,0.06)", border: "1px solid " + color + "66",
    borderRadius: 8, color: "#fff", fontFamily: "monospace", fontSize: 12,
    padding: "12px 16px", cursor: "pointer", textAlign: "left", width: "100%",
    boxShadow: "0 0 12px " + color + "33",
  };
}

function glowBtn(c1, c2) {
  return {
    background: "linear-gradient(135deg," + c1 + "," + c2 + ")",
    border: "none", borderRadius: 8, color: "#fff", fontFamily: "monospace",
    fontWeight: "bold", fontSize: 13, padding: "10px 22px", cursor: "pointer",
    boxShadow: "0 0 22px " + c1 + "66, 0 2px 8px rgba(0,0,0,0.4)",
  };
                  }
