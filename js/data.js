export const monthMetadata = [
    { id: 1, title: "Month 1: Cyan Shield Protocol (Days 1-30)", goal: "Strip away the grease mantle, neutralize the fungal itch, and prepare clean follicle beds. Derma Roller is locked for week 1.", length: 30 },
    { id: 2, title: "Month 2: Neon Integration Node (Days 31-60)", goal: "Introduce systematic micro-needling trauma pipelines to force structural tissue regeneration signaling vectors.", length: 30 },
    { id: 3, title: "Month 3: Hypertrophy Acceleration Vector (Days 61-91)", goal: "Maximize nutrient assimilation pathways. Capillary networks lock into steady operational baseline configurations.", length: 31 },
    { id: 4, title: "Month 4: High-Tensile Synthesis Matrix (Days 92-121)", goal: "Reinforce newly stabilized growth chains, enhancing macro-level structural protein linkage tensile limits.", length: 30 },
    { id: 5, title: "Month 5: Sovereign Density Nexus (Days 122-152)", goal: "Lock in follicular visual thickness gains and permanently solidify systemic compliance rhythms.", length: 31 }
];

export const labelDefinitions = {
    'M': 'Micronutrient (Multi-Tablet)',
    'S': 'Spray (Rosemary & Caffeine)',
    'W': 'Wash (BBlunt Anti-Dandruff)',
    'O': 'Oil (Ends Protection)',
    'D': 'Roller (0.5mm Scalp Session)'
};

export function calculateActionsForDay(absoluteDay) {
    let tasks = ['M']; // Micronutrients occur daily across all arrays
    
    // Day 1 to 7 Lockout Rule: No rolling allowed during Week 1
    if (absoluteDay >= 1 && absoluteDay <= 30) {
        if (absoluteDay === 1 || absoluteDay === 7 || absoluteDay === 13 || absoluteDay === 19 || absoluteDay === 25) {
            tasks.push('S', 'W');
        } else if (absoluteDay === 2 || absoluteDay === 14) {
            tasks.push('S');
        } else if (absoluteDay === 8 || absoluteDay === 20) {
            tasks.push('D'); // Day 8 and 20 target roller action sequences
        } else {
            tasks.push('S');
        }
        if (absoluteDay === 7) tasks.push('O');
    } 
    else if (absoluteDay >= 31 && absoluteDay <= 60) {
        if ([31, 37, 43, 49, 55].includes(absoluteDay)) {
            tasks.push('S', 'W');
        } else if ([32, 38, 44, 50, 56].includes(absoluteDay)) {
            tasks.push('D');
        } else {
            tasks.push('S');
        }
        if (absoluteDay === 31 || absoluteDay === 55) tasks.push('O');
    }
    else if (absoluteDay >= 61 && absoluteDay <= 91) {
        if ([61, 67, 73, 79, 85, 91].includes(absoluteDay)) {
            tasks.push('S', 'W');
        } else if ([62, 68, 74, 80, 86].includes(absoluteDay)) {
            tasks.push('D');
        } else {
            tasks.push('S');
        }
        if ([61, 73, 85].includes(absoluteDay)) tasks.push('O');
    }
    else if (absoluteDay >= 92 && absoluteDay <= 121) {
        if ([92, 98, 104, 110, 116].includes(absoluteDay)) {
            tasks.push('S');
        } else if ([93, 99, 105, 111, 117].includes(absoluteDay)) {
            tasks.push('S', 'W');
        } else if ([94, 100, 106, 112].includes(absoluteDay)) {
            tasks.push('D');
        } else if (absoluteDay === 118) {
            tasks.push('D');
        } else {
            tasks.push('S');
        }
        if ([93, 99, 114].includes(absoluteDay)) tasks.push('O');
    }
    else if (absoluteDay >= 122 && absoluteDay <= 152) {
        if ([122, 128, 134, 140, 146, 152].includes(absoluteDay)) {
            tasks.push('S', 'W');
        } else if ([123, 129, 135, 141, 147].includes(absoluteDay)) {
            tasks.push('D');
        } else {
            tasks.push('S');
        }
        if ([122, 134, 146].includes(absoluteDay)) tasks.push('O');
    }
    
    return tasks;
}