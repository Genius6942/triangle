import { calculateIncrease } from "..";

export const garbageData = {
  single: 0,
  double: 1,
  triple: 2,
  quad: 4,
  penta: 5,
  tspinMini: 0,
  tspin: 0,
  tspinMiniSingle: 0,
  tspinSingle: 2,
  tspinMiniDouble: 1,
  tspinDouble: 4,
  tspinTriple: 6,
  tspinQuad: 10,
  tspinPenta: 12,
  backtobackBonus: 1,
  backtobackBonusLog: 0.8,
  comboMinifier: 1,
  comboMinifierLog: 1.25,
  comboBonus: 0.25,
  allClear: 10,
  comboTable: {
    none: [0],
    "classic guideline": [0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
    "modern guideline": [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4]
  }
};

export const garbageCalcV2 = (
  data: {
    lines: number;
    spin: undefined | "none" | "mini" | "normal" | "full";
    piece: "L" | "J" | "T" | "S" | "Z" | "I" | "O";
    b2b: number;
    combo: number;
    enemies: number;
    frame: number;
  },
  config: {
    spinBonuses: string;
    comboTable: keyof (typeof garbageData)["comboTable"] | "multiplier";
    b2bChaining: boolean;
    garbageTargetBonus: "none" | "normal" | string;
    garbageMultiplier: {
      value: number;
      increase: number;
      marginTime: number;
    };
    garbageAttackCap?: number;
    garbageBlocking: "combo blocking" | "limited blocking" | "none";
  }
) => {
  let garbage = 0;
  const { spin: rawSpin, lines, piece, combo, b2b, enemies } = data;
  const {
    spinBonuses,
    comboTable,
    b2bChaining,
    garbageMultiplier,
    garbageTargetBonus,
    garbageAttackCap,
    garbageBlocking
  } = config;

  const spin: "mini" | "normal" | null | undefined =
    rawSpin === "none" ? null : rawSpin === "full" ? "normal" : rawSpin;

  switch (lines) {
    case 0:
      garbage =
        spin === "mini"
          ? garbageData.tspinMini
          : spin === "normal"
            ? garbageData.tspin
            : 0;
      break;
    case 1:
      garbage =
        spin === "mini"
          ? garbageData.tspinMiniSingle
          : spin === "normal"
            ? garbageData.tspinSingle
            : garbageData.single;
      break;
    case 2:
      garbage =
        spin === "mini"
          ? garbageData.tspinMiniDouble
          : spin === "normal"
            ? garbageData.tspinDouble
            : garbageData.double;
      break;
    case 3:
      garbage = spin ? garbageData.tspinTriple : garbageData.triple;
      break;
    case 4:
      garbage = spin ? garbageData.tspinQuad : garbageData.quad;
      break;
    case 5:
      garbage = spin ? garbageData.tspinPenta : garbageData.penta;
      break;
    default: {
      const t = lines - 5;
      garbage = spin ? garbageData.tspinPenta + 2 * t : garbageData.penta + t;
      break;
    }
  }

  if (spin && spinBonuses === "handheld" && piece.toUpperCase() !== "T") {
    garbage /= 2;
  }

  if (lines > 0 && b2b > 0) {
    if (b2bChaining) {
      const b2bGains =
        garbageData.backtobackBonus *
        (Math.floor(1 + Math.log1p(b2b * garbageData.backtobackBonusLog)) +
          (b2b == 1
            ? 0
            : (1 + (Math.log1p(b2b * garbageData.backtobackBonusLog) % 1)) /
              3));
      garbage += b2bGains;
    } else {
      garbage += garbageData.backtobackBonus;
    }
  }

  if (combo > 0) {
    if (comboTable === "multiplier") {
      garbage *= 1 + garbageData.comboBonus * combo;
      if (combo > 1) {
        garbage = Math.max(
          Math.log1p(
            garbageData.comboMinifier * combo * garbageData.comboMinifierLog
          ),
          garbage
        );
      }
    } else {
      const comboTableData = garbageData.comboTable[comboTable] || [0];
      garbage +=
        comboTableData[
          Math.max(0, Math.min(combo - 1, comboTableData.length - 1))
        ];
    }
  }

  const garbageMultiplierValue = calculateIncrease(
    garbageMultiplier.value,
    data.frame,
    garbageMultiplier.increase,
    garbageMultiplier.marginTime
  );

  let garbageBonus = 0;
  if (lines > 0 && garbageTargetBonus !== "none") {
    let targetBonus = 0;
    switch (enemies) {
      case 0:
      case 1:
        break;
      case 2:
        targetBonus += 1;
        break;
      case 3:
        targetBonus += 3;
        break;
      case 4:
        targetBonus += 5;
        break;
      case 5:
        targetBonus += 7;
        break;
      default:
        targetBonus += 9;
    }

    if (garbageTargetBonus === "normal") {
      garbage += targetBonus;
    } else {
      garbageBonus = Math.floor(targetBonus * garbageMultiplierValue);
    }
  }

  let l = Math.floor(garbage * garbageMultiplierValue);
  if (garbageAttackCap) {
    l = Math.floor(Math.min(garbageAttackCap, l));
  }
  switch (garbageBlocking) {
  }

  // TODO: what is e.atm.fightlines, what is garbagebonus

  return {
    garbage: l,
    bonus: garbageBonus
  };
};
