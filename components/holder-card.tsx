"use client";

import { useEffect, useRef, useState } from "react";
import { avatarUrl, pad, type CurrentJoint } from "@/lib/client/api";

type Props = {
  current: CurrentJoint | null;
  rig: string;
  strain: string;
  emberId?: string;
};

export function HolderCard({ current, rig, strain, emberId = "rig-ember" }: Props) {
  const handle = current?.currentHolder || null;
  const message = current?.currentMessage || null;
  const passes = current?.totalPasses ?? 0;
  const fee = current?.passFeeUsd ?? "0.00402";

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [handle]);

  const sinceMs = current?.currentSince
    ? new Date(current.currentSince).getTime()
    : null;

  const [hold, setHold] = useState({ h: "0", m: "00", s: "00" });

  useEffect(() => {
    function tick() {
      if (!sinceMs) {
        setHold({ h: "0", m: "00", s: "00" });
        return;
      }
      const sec = Math.max(0, Math.floor((Date.now() - sinceMs) / 1000));
      setHold({
        h: String(Math.floor(sec / 3600)),
        m: pad(Math.floor((sec % 3600) / 60)),
        s: pad(sec % 60),
      });
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sinceMs]);

  return (
    <>
      <div className="av-holder">
        <div className="avatar" id="avatar">
          {handle && !imgFailed && (
            <img
              alt=""
              crossOrigin="anonymous"
              src={avatarUrl(handle)}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              style={{ display: imgLoaded ? "block" : "none" }}
            />
          )}
          {(!handle || !imgLoaded) && (
            <div className="fb">{handle ? handle[0].toUpperCase() : "·"}</div>
          )}
        </div>
      </div>

      <div className="holder-at">
        <span className="at">@</span>
        <span>{handle || "nobody"}</span>
      </div>

      <p className="holder-bio">
        {message ||
          (handle
            ? "currently holding the joint."
            : "no one is holding the joint yet. be the first.")}
      </p>

      <div className="holder-stats">
        <div className="stat-cell">
          <span className="v">{passes}</span>
          <span className="l">total passes</span>
        </div>
        <div className="stat-cell">
          <span className="v">${fee}</span>
          <span className="l">pass fee</span>
        </div>
      </div>

      <div className="timer-block">
        <div className="timer-label">
          <span className="ember-dot" id={emberId} aria-hidden="true"></span>
          holding · <span>{rig}</span> · <span className="strain">{strain}</span>
        </div>
        <div className="hold-timer">
          <span className="t-group">
            <span className="t-n">{hold.h}</span>
            <span className="t-u">h</span>
          </span>
          <span className="t-sep">:</span>
          <span className="t-group">
            <span className="t-n">{hold.m}</span>
            <span className="t-u">m</span>
          </span>
          <span className="t-sep">:</span>
          <span className="t-group">
            <span className="t-n">{hold.s}</span>
            <span className="t-u">s</span>
          </span>
        </div>
      </div>
    </>
  );
}
