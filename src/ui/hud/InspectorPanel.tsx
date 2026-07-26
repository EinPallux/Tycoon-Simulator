"use client";

/**
 * Left-dock inspector for the selected placeable — scenery, stall, or ride
 * (UI_UX_DESIGN.md §7.6). Rides get open/close + pricing + live stats;
 * stalls get item pricing + today's sales.
 */

import { useEffect, useMemo, useState } from "react";
import { getPlaceableDef } from "@/content/catalog";
import type { PlaceableDef } from "@/content/types";
import { CONTRACTOR_REPAIR_COST, RENOVATE_COST_RATE } from "@/sim/balance/phase3";
import { coasterCost, FAMILY_INFO, type Coaster } from "@/sim/coaster/coaster";
import { REFUND_GRACE_TICKS, DEMOLISH_REFUND } from "@/sim/commands";
import type { PlacedEntity, RideState, StallState } from "@/sim/world/world";
import { formatMoney } from "@/ui/format";
import { Button } from "@/ui/kit/Button";
import { Panel } from "@/ui/kit/Panel";
import { Slider } from "@/ui/kit/Slider";
import { useGameStore } from "@/ui/stores/gameStore";

export function InspectorPanel() {
  const selectedEntity = useGameStore((s) => s.selectedEntity);
  const worldVersion = useGameStore((s) => s.worldVersion);
  const selectEntity = useGameStore((s) => s.selectEntity);
  const setTool = useGameStore((s) => s.setTool);
  // Live values (queue length, income) refresh on a gentle cadence.
  const [, pulse] = useState(0);
  useEffect(() => {
    if (selectedEntity === null) return;
    const timer = setInterval(() => pulse((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, [selectedEntity]);

  const info = useMemo(() => {
    const sim = useGameStore.getState().sim;
    if (!sim || selectedEntity === null) return null;
    const entity = sim.world.placeables.get(selectedEntity);
    if (!entity) return null;
    const def = getPlaceableDef(entity.defId);
    const coaster = sim.world.coasters.get(entity.id) ?? null;
    const baseCost = coaster ? coasterCost(coaster.family, coaster.pieces) : def.cost;
    const withinGrace = sim.world.time - entity.placedAt <= REFUND_GRACE_TICKS;
    const refundRate = def.category === "scenery" && withinGrace ? 1 : DEMOLISH_REFUND;
    return { entity, def, coaster, baseCost, withinGrace, refund: Math.round(baseCost * refundRate) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion tracks external world edits
  }, [selectedEntity, worldVersion]);

  if (!info) return null;
  const { entity, def, coaster, baseCost, withinGrace, refund } = info;
  const sim = useGameStore.getState().sim;
  const ride = sim?.world.rides.get(entity.id) ?? null;
  const stall = sim?.world.stalls.get(entity.id) ?? null;

  return (
    <div className="pointer-events-auto absolute left-4 top-20 w-80">
      <Panel title={coaster ? FAMILY_INFO[coaster.family].name : def.name} onClose={() => selectEntity(null)}>
        <div className="flex flex-col gap-3 text-sm">
          {ride && coaster && <CoasterSection entity={entity} ride={ride} coaster={coaster} />}
          {ride && def.ride && <RideSection entity={entity} def={def} ride={ride} />}
          {ride && <MaintenanceSection entity={entity} ride={ride} baseCost={baseCost} />}
          {stall && def.stall && <StallSection def={def} stall={stall} />}
          {!ride && !stall && (
            <>
              <Row label="Type" value={def.category} />
              <Row label="Build cost" value={formatMoney(def.cost)} />
              <Row
                label="Beauty"
                value={"★".repeat(Math.max(1, Math.round(def.beauty / 2)))}
              />
              {def.themeTag && <Row label="Theme" value={def.themeTag} />}
            </>
          )}

          <div className="mt-1 flex gap-2">
            {!coaster && (
              <Button
                size="sm"
                variant="secondary"
                className="!border-ink-900/40 !text-ink-900 hover:!border-accent-600 hover:!text-accent-600"
                onClick={() => setTool({ kind: "move", entityId: entity.id, rot: entity.rot })}
              >
                Move{withinGrace ? " (free)" : ` (${formatMoney(Math.round(def.cost * 0.1))})`}
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                useGameStore.getState().sim?.dispatch({ type: "remove-entity", id: entity.id });
                selectEntity(null);
              }}
            >
              Demolish (+{formatMoney(refund)})
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-600">{label}</span>
      <b className="tabular capitalize">{value}</b>
    </div>
  );
}

function RideSection({
  entity,
  def,
  ride,
}: {
  entity: PlacedEntity;
  def: PlaceableDef;
  ride: RideState;
}) {
  const cfg = def.ride;
  if (!cfg) return null;
  const dispatch = (price: number): void => {
    useGameStore.getState().sim?.dispatch({ type: "set-price", id: entity.id, price });
  };
  return (
    <>
      <div className="flex items-center justify-between">
        <span
          className={`skewed px-2 py-0.5 text-[11px] font-bold uppercase text-paper-050 ${ride.open ? "bg-good-500" : "bg-danger-500"}`}
        >
          <span className="unskew inline-block">
            {ride.open ? `Open — ${ride.phase}` : "Closed"}
          </span>
        </span>
        <Button
          size="sm"
          variant={ride.open ? "ghost" : "primary"}
          className={ride.open ? "!text-ink-900" : ""}
          onClick={() =>
            useGameStore.getState().sim?.dispatch({
              type: "set-ride-open",
              id: entity.id,
              open: !ride.open,
            })
          }
        >
          {ride.open ? "Close ride" : "Open ride"}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatDial label="Excite" value={cfg.excitement} color="text-good-500" />
        <StatDial label="Intense" value={cfg.intensity} color="text-card-orange" />
        <StatDial label="Nausea" value={cfg.nausea} color="text-card-purple" />
      </div>
      <div className="-mx-2">
        <Slider
          label="Ticket"
          value={ride.price / 100}
          min={0}
          max={12}
          step={0.5}
          onChange={(v) => dispatch(Math.round(v * 100))}
          format={(v) => `$${v.toFixed(2).replace(/\.00$/, "")}`}
        />
      </div>
      <Row label="In queue" value={`${ride.queue.length} guests`} />
      <Row label="Riding now" value={`${ride.riders.length}/${cfg.capacity}`} />
      <Row label="Riders (lifetime)" value={`${ride.lifetimeRiders}`} />
      <Row label="Income today" value={formatMoney(ride.incomeToday)} />
      <Row label="Upkeep" value={`${formatMoney(cfg.runningPerDay)}/day`} />
    </>
  );
}

function StatDial({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-paper-100 py-2">
      <div className={`tabular text-lg font-extrabold ${color}`}>{value.toFixed(1)}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-600">{label}</div>
    </div>
  );
}

function CoasterSection({
  entity,
  ride,
  coaster,
}: {
  entity: PlacedEntity;
  ride: RideState;
  coaster: Coaster;
}) {
  const stats = coaster.stats;
  const family = FAMILY_INFO[coaster.family];
  return (
    <>
      <div className="flex items-center justify-between">
        <span
          className={`skewed px-2 py-0.5 text-[11px] font-bold uppercase text-paper-050 ${
            ride.phase === "broken" ? "bg-danger-500" : ride.open ? "bg-good-500" : "bg-danger-500"
          }`}
        >
          <span className="unskew inline-block">
            {ride.phase === "broken" ? "Broken down!" : ride.open ? `Open — ${ride.phase}` : "Closed"}
          </span>
        </span>
        <Button
          size="sm"
          variant={ride.open ? "ghost" : "primary"}
          className={ride.open ? "!text-ink-900" : ""}
          onClick={() =>
            useGameStore.getState().sim?.dispatch({
              type: "set-ride-open",
              id: entity.id,
              open: !ride.open,
            })
          }
        >
          {ride.open ? "Close ride" : "Open ride"}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatDial label="Excite" value={stats.excitement} color="text-good-500" />
        <StatDial label="Intense" value={stats.intensity} color="text-card-orange" />
        <StatDial label="Nausea" value={stats.nausea} color="text-card-purple" />
      </div>
      <Row
        label="Track"
        value={`${coaster.pieces.length} pieces · ${Math.round(stats.trackLength * 2)} m`}
      />
      <Row
        label="Top speed"
        value={`${Math.round(stats.maxSpeed * 2 * 3.6)} km/h · ${Math.round(stats.rideTimeSec)}s ride`}
      />
      {(stats.drops > 0 || stats.inversions > 0) && (
        <Row
          label="Thrills"
          value={`${stats.drops} drop${stats.drops === 1 ? "" : "s"}${stats.inversions > 0 ? ` · ${stats.inversions} inversion${stats.inversions === 1 ? "" : "s"}` : ""}`}
        />
      )}
      <div className="-mx-2">
        <Slider
          label="Ticket"
          value={ride.price / 100}
          min={0}
          max={12}
          step={0.5}
          onChange={(v) =>
            useGameStore.getState().sim?.dispatch({
              type: "set-price",
              id: entity.id,
              price: Math.round(v * 100),
            })
          }
          format={(v) => `$${v.toFixed(2).replace(/\.00$/, "")}`}
        />
      </div>
      <Row label="In queue" value={`${ride.queue.length} guests`} />
      <Row label="Riders (lifetime)" value={`${ride.lifetimeRiders}`} />
      <Row label="Income today" value={formatMoney(ride.incomeToday)} />
      <Row label="Upkeep" value={`${formatMoney(family.runningPerDay)}/day`} />
      <Button
        size="sm"
        onClick={() => useGameStore.getState().setOnboardCoaster(entity.id)}
      >
        🎥 Ride it (onboard cam)
      </Button>
    </>
  );
}

/** Reliability + repair/renovate controls — every ride wears out (§8). */
function MaintenanceSection({
  entity,
  ride,
  baseCost,
}: {
  entity: PlacedEntity;
  ride: RideState;
  baseCost: number;
}) {
  const sim = useGameStore.getState().sim;
  const reliability = Math.round(ride.reliability);
  const renovateCost = Math.round(baseCost * RENOVATE_COST_RATE);
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs font-semibold text-ink-600">Reliability</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-900/10">
          <div
            className={`h-full ${reliability > 60 ? "bg-good-500" : reliability > 30 ? "bg-card-orange" : "bg-danger-500"}`}
            style={{ width: `${reliability}%` }}
          />
        </div>
        <span className="tabular w-8 text-right text-xs font-bold">{reliability}</span>
      </div>
      {ride.phase === "broken" && (
        <div className="flex items-center justify-between gap-2 bg-danger-500/10 px-2 py-1.5">
          <span className="text-xs text-danger-600">
            {ride.repairT > 0
              ? "🔧 Contractor on it…"
              : ride.repairT === -1
                ? "🔧 Mechanic on it…"
                : "💥 Awaiting repair — got a mechanic?"}
          </span>
          {ride.repairT === 0 && (
            <Button
              size="sm"
              onClick={() => sim?.dispatch({ type: "call-repair", id: entity.id })}
            >
              Call repair ({formatMoney(CONTRACTOR_REPAIR_COST)})
            </Button>
          )}
        </div>
      )}
      {reliability < 70 && ride.phase !== "broken" && (
        <Button
          size="sm"
          variant="secondary"
          className="!border-ink-900/40 !text-ink-900 hover:!border-accent-600 hover:!text-accent-600"
          onClick={() => sim?.dispatch({ type: "renovate-ride", id: entity.id })}
        >
          Renovate — reliability 100 ({formatMoney(renovateCost)})
        </Button>
      )}
    </>
  );
}

function StallSection({ def, stall }: { def: PlaceableDef; stall: StallState }) {
  const cfg = def.stall;
  if (!cfg) return null;
  const isFree = cfg.price === 0;
  return (
    <>
      <Row label="Sells" value={cfg.item} />
      {!isFree && (
        <div className="-mx-2">
          <Slider
            label={`${cfg.item} price`}
            value={stall.price / 100}
            min={0}
            max={Math.max(3, (cfg.price / 100) * 3)}
            step={0.25}
            onChange={(v) =>
              useGameStore.getState().sim?.dispatch({
                type: "set-price",
                id: stall.entityId,
                price: Math.round(v * 100),
              })
            }
            format={(v) => `$${v.toFixed(2).replace(/\.00$/, "")}`}
          />
        </div>
      )}
      {isFree && <Row label="Price" value="Free (public service)" />}
      <Row label="Cost of goods" value={`${formatMoney(cfg.cogs)}/sale`} />
      <Row label="Sales today" value={`${stall.salesToday}`} />
      <Row label="Income today" value={formatMoney(stall.incomeToday)} />
      {stall.price > cfg.price * 1.3 && (
        <p className="text-xs text-danger-500">
          Guests think this is a rip-off — expect refusals and grumbling.
        </p>
      )}
    </>
  );
}
