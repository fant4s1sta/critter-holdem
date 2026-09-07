"use client";

import { tableItemSrc, type TableItemId } from "@/lib/table-items";

function ItemDropArt({ itemId }: { itemId: TableItemId }) {
  return (
    <img
      className="item-drop-art"
      src={tableItemSrc(itemId)}
      alt=""
      draggable={false}
    />
  );
}

export function BombHit({ at, landed }: { at: number; landed?: boolean }) {
  return (
    <div className={`seat-bomb-hit${landed ? " is-landed" : ""}`} key={at} aria-hidden="true">
      <div className="bomb-fx">
        {landed ? null : (
          <div className="bomb-fx-drop">
            <ItemDropArt itemId="bomb" />
          </div>
        )}
        <div className="bomb-fx-layer">
          <span className="bomb-fx-fire" />
          <span className="bomb-fx-flash" />
          <span className="bomb-fx-core" />
          <span className="bomb-fx-burst" />
          <span className="bomb-fx-ring a" />
          <span className="bomb-fx-ring b" />
          <span className="bomb-fx-sparks">
            <i /><i /><i /><i /><i /><i /><i /><i />
            <i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span className="bomb-fx-embers">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span className="bomb-fx-shards">
            <i /><i /><i /><i /><i /><i />
          </span>
          <span className="bomb-fx-smoke">
            <i /><i /><i /><i /><i /><i />
          </span>
        </div>
      </div>
    </div>
  );
}

function EggHit({ at, landed }: { at: number; landed?: boolean }) {
  return (
    <div className={`seat-item-hit is-egg${landed ? " is-landed" : ""}`} key={at} aria-hidden="true">
      <div className="item-fx">
        {landed ? null : (
          <div className="egg-drop">
            <ItemDropArt itemId="egg" />
          </div>
        )}
        <div className="item-fx-layer">
          <span className="egg-flash" />
          <span className="egg-white" />
          <span className="egg-yolk" />
          <span className="egg-yolk-highlight" />
          <span className="egg-shards">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span className="egg-specks">
            <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span className="egg-drips">
            <i /><i /><i /><i /><i />
          </span>
        </div>
      </div>
    </div>
  );
}

function TomatoHit({ at, landed }: { at: number; landed?: boolean }) {
  return (
    <div className={`seat-item-hit is-tomato${landed ? " is-landed" : ""}`} key={at} aria-hidden="true">
      <div className="item-fx">
        {landed ? null : (
          <div className="tomato-drop">
            <ItemDropArt itemId="tomato" />
          </div>
        )}
        <div className="item-fx-layer">
          <span className="tomato-flash" />
          <span className="tomato-splat a" />
          <span className="tomato-splat b" />
          <span className="tomato-splat c" />
          <span className="tomato-ring" />
          <span className="tomato-seeds">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span className="tomato-drops">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span className="tomato-drips">
            <i /><i /><i /><i />
          </span>
        </div>
      </div>
    </div>
  );
}

function HeartHit({ at, landed }: { at: number; landed?: boolean }) {
  const heartSrc = tableItemSrc("heart");
  return (
    <div className={`seat-item-hit is-heart${landed ? " is-landed" : ""}`} key={at} aria-hidden="true">
      <div className="item-fx">
        {landed ? null : (
          <div className="heart-drop">
            <ItemDropArt itemId="heart" />
          </div>
        )}
        <div className="item-fx-layer">
          <span className="heart-glow" />
          <span className="heart-ring" />
          <span className="heart-burst">
            <i><img src={heartSrc} alt="" draggable={false} /></i>
            <i><img src={heartSrc} alt="" draggable={false} /></i>
            <i><img src={heartSrc} alt="" draggable={false} /></i>
            <i><img src={heartSrc} alt="" draggable={false} /></i>
            <i><img src={heartSrc} alt="" draggable={false} /></i>
            <i><img src={heartSrc} alt="" draggable={false} /></i>
            <i><img src={heartSrc} alt="" draggable={false} /></i>
            <i><img src={heartSrc} alt="" draggable={false} /></i>
          </span>
          <span className="heart-sparkles">
            <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
          </span>
        </div>
      </div>
    </div>
  );
}

export function ItemHitFx({
  itemId,
  at,
  landed,
}: {
  itemId: TableItemId;
  at: number;
  landed?: boolean;
}) {
  if (itemId === "bomb") return <BombHit at={at} landed={landed} />;
  if (itemId === "egg") return <EggHit at={at} landed={landed} />;
  if (itemId === "tomato") return <TomatoHit at={at} landed={landed} />;
  return <HeartHit at={at} landed={landed} />;
}
