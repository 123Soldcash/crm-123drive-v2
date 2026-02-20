/**
 * Migration script: Copy data from old propertyDeepSearch to new tables
 * - deepSearchOverview: qualitative data (condition, occupancy, seller situation, legal, probate, notes)
 * - financialModule: financial data (taxes, repairs, mortgage, liens, foreclosure, deed history)
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Fetch all old records
const [oldRecords] = await conn.query('SELECT * FROM propertyDeepSearch');
console.log(`Found ${oldRecords.length} records in old propertyDeepSearch table`);

for (const old of oldRecords) {
  const pid = old.propertyId;
  console.log(`\nMigrating propertyId=${pid}...`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DEEP SEARCH OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  // Map old occupancy enum to new enum
  const occupancyMap = {
    'Owner-Occupied': 'Owner Occupied',
    'Tenant-Occupied': 'Tenant Occupied',
    'Abandoned': 'Vacant',
    'Vacant': 'Vacant',
    'Squatters': 'Squatter Occupied',
    'Relatives': 'Owner Occupied', // closest match
    'Partially Occupied': 'Owner Occupied',
    'Second Home': 'Owner Occupied',
  };
  const newOccupancy = old.occupancy ? (occupancyMap[old.occupancy] || 'Unknown') : null;

  // Parse propertyCondition JSON
  let conditionRating = null;
  let conditionTags = null;
  if (old.propertyCondition) {
    try {
      const pc = JSON.parse(old.propertyCondition);
      conditionRating = pc.rating || null;
      // Map old condition tags to new format
      const tagMap = {
        'Boarded Up': 'Boarded Up',
        'Needs New Roof': 'Needs New Roof',
        'Squatter Occupied': 'Abandoned', // condition tag, not occupancy
        'Major Repairs': 'Major Repairs Needed',
        'Needs Repairs': 'Needs Repairs',
        'Deferred Maintenance': 'Deferred Maintenance',
        'Water Damage': 'Water Damage',
        'Flood Damage': 'Flood Damage',
        'Mold Damage': 'Mold Damage',
        'Fire Damage': 'Fire Damage',
        'Hurricane Damage': 'Hurricane Damage',
        'Under Construction': 'Under Construction',
        'Partially Renovated': 'Partially Renovated',
        'Old/Damaged Carpet': 'Old/Damaged Carpet',
        'Warning Stickers on Door': 'Warning Stickers on Door',
        'Locked Gates': 'Locked Gates',
        'Condemned': 'Condemned',
        'Unlivable': 'Unlivable',
        'Outdated': 'Deferred Maintenance',
      };
      if (pc.tags && Array.isArray(pc.tags)) {
        conditionTags = JSON.stringify(pc.tags.map(t => tagMap[t] || t));
      }
    } catch (e) {
      console.log(`  Warning: Could not parse propertyCondition for pid=${pid}`);
    }
  }

  // Parse propertyType JSON
  let propertyType = null;
  let propertyTags = null;
  if (old.propertyType) {
    try {
      const pt = JSON.parse(old.propertyType);
      // Map old type to new enum
      const typeMap = {
        'Single Family Home': 'Single Family Home',
        'Condo': 'Condo',
        'Duplex': 'Duplex',
        'Triplex': 'Triplex',
        'Fourplex': 'Fourplex',
        'Townhouse': 'Townhouse',
        'Mobile Home': 'Mobile Home',
        'Vacant Lot': 'Vacant Lot',
      };
      propertyType = pt.type ? (typeMap[pt.type] || 'Other') : null;
      if (pt.tags && Array.isArray(pt.tags)) {
        propertyTags = JSON.stringify(pt.tags);
      }
    } catch (e) {
      console.log(`  Warning: Could not parse propertyType for pid=${pid}`);
    }
  }

  // Parse issues JSON to determine probate and seller situation
  let isProbate = 0;
  let sellerFinancialPressure = null;
  let sellerLifeEvents = null;
  let sellerLegalBehavioral = null;
  if (old.issues) {
    try {
      const issues = JSON.parse(old.issues);
      if (issues.includes('Probate')) isProbate = 1;
      
      // Map old issues to new seller situation categories
      const financialIssues = issues.filter(i => ['Behind mortgage', 'Behind Taxes', 'Need Cash Quickly', 'Medical Bills', 'Job Loss', 'Bankruptcy'].includes(i));
      const lifeIssues = issues.filter(i => ['Divorce', 'Death in the Family', 'Relocating', 'Downsizing', 'Moving to Another City', 'Moving to Another County', 'Moving to Another State'].includes(i));
      const legalIssues = issues.filter(i => ['Deportation', 'Going to Jail/Incarceration', 'Hoarder Situation'].includes(i));
      
      if (financialIssues.length > 0) sellerFinancialPressure = JSON.stringify(financialIssues);
      if (lifeIssues.length > 0) sellerLifeEvents = JSON.stringify(lifeIssues);
      if (legalIssues.length > 0) sellerLegalBehavioral = JSON.stringify(legalIssues);
    } catch (e) {
      console.log(`  Warning: Could not parse issues for pid=${pid}`);
    }
  }

  // Parse probateFinds
  let probateFindings = null;
  if (old.probateFinds) {
    try {
      const pf = JSON.parse(old.probateFinds);
      if (Array.isArray(pf) && pf.length > 0) {
        probateFindings = JSON.stringify(pf);
      }
    } catch (e) {
      console.log(`  Warning: Could not parse probateFinds for pid=${pid}`);
    }
  }

  // Check if record already exists
  const [existing] = await conn.query('SELECT id FROM deepSearchOverview WHERE propertyId = ?', [pid]);
  
  if (existing.length > 0) {
    console.log(`  Overview record already exists for pid=${pid}, skipping...`);
  } else {
    await conn.query(
      `INSERT INTO deepSearchOverview (
        propertyId, ds_propertyType, ds_propertyTags, ds_conditionRating, ds_conditionTags,
        ds_occupancy, ds_sellerFinancialPressure, ds_sellerLifeEvents, ds_sellerLegalBehavioral,
        ds_probate, ds_probateFindings, ds_probateNotes, ds_generalNotes, ds_distressScore
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        pid, propertyType, propertyTags, conditionRating, conditionTags,
        newOccupancy, sellerFinancialPressure, sellerLifeEvents, sellerLegalBehavioral,
        isProbate, probateFindings, old.probateNotes || null, old.overviewNotes || null, 0
      ]
    );
    console.log(`  ✅ Overview inserted for pid=${pid}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. FINANCIAL MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // Map mortgage
  let mortgageVal = null;
  if (old.hasMortgage === 1) mortgageVal = 'Yes';
  else if (old.hasMortgage === 0) mortgageVal = 'No';

  // Parse repairTypes
  let repairCategories = null;
  if (old.repairTypes) {
    try {
      const rt = JSON.parse(old.repairTypes);
      if (Array.isArray(rt) && rt.length > 0) {
        repairCategories = JSON.stringify(rt);
      }
    } catch (e) {
      console.log(`  Warning: Could not parse repairTypes for pid=${pid}`);
    }
  }

  // Parse deedType
  let deedHistory = null;
  if (old.deedType) {
    try {
      const dt = JSON.parse(old.deedType);
      if (Array.isArray(dt) && dt.length > 0) {
        // Map to new format: {type, date, amount, notes}
        const mapped = dt.filter(d => d.type).map(d => ({
          type: d.type,
          date: d.deedDate || '',
          amount: d.amount ? String(d.amount) : '',
          notes: d.notes || ''
        }));
        if (mapped.length > 0) deedHistory = JSON.stringify(mapped);
      }
    } catch (e) {
      console.log(`  Warning: Could not parse deedType for pid=${pid}`);
    }
  }

  // Calculate tax total
  const taxTotal = (old.delinquentTax2025 || 0) + (old.delinquentTax2024 || 0) + 
    (old.delinquentTax2023 || 0) + (old.delinquentTax2022 || 0) + 
    (old.delinquentTax2021 || 0) + (old.delinquentTax2020 || 0);

  const [existingFin] = await conn.query('SELECT id FROM financialModule WHERE propertyId = ?', [pid]);
  
  if (existingFin.length > 0) {
    console.log(`  Financial record already exists for pid=${pid}, skipping...`);
  } else {
    // Only insert if there's any financial data
    const hasFinancialData = old.delinquentTax2025 || old.delinquentTax2024 || old.delinquentTax2023 ||
      old.delinquentTax2022 || old.delinquentTax2021 || old.delinquentTax2020 ||
      old.hasMortgage || old.needsRepairs || old.hasCodeViolation || old.hasLiens || old.deedType;

    if (hasFinancialData) {
      await conn.query(
        `INSERT INTO financialModule (
          propertyId, fm_delinquentTax2025, fm_delinquentTax2024, fm_delinquentTax2023,
          fm_delinquentTax2022, fm_delinquentTax2021, fm_delinquentTax2020, fm_delinquentTaxTotal,
          fm_needsRepairs, fm_repairCategories, fm_estimatedRepairCost, fm_repairNotes,
          fm_mortgage, fm_mortgageNotes, fm_liens, fm_lienNotes,
          fm_codeViolations, fm_codeTaxNotes, fm_deedHistory
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pid,
          old.delinquentTax2025 || null, old.delinquentTax2024 || null, old.delinquentTax2023 || null,
          old.delinquentTax2022 || null, old.delinquentTax2021 || null, old.delinquentTax2020 || null,
          taxTotal > 0 ? taxTotal : null,
          old.needsRepairs || 0, repairCategories, old.estimatedRepairCost || null, old.repairNotes || null,
          mortgageVal, old.mortgageNotes || null, old.hasLiens || 0, old.liensNotes || null,
          old.hasCodeViolation || 0, old.codeViolationNotes || null, deedHistory
        ]
      );
      console.log(`  ✅ Financial inserted for pid=${pid}`);
    } else {
      console.log(`  ⏭️  No financial data for pid=${pid}, skipping financial module`);
    }
  }
}

// Verify migration
const [overviewCount] = await conn.query('SELECT COUNT(*) as c FROM deepSearchOverview');
const [financialCount] = await conn.query('SELECT COUNT(*) as c FROM financialModule');
console.log(`\n═══════════════════════════════════════════`);
console.log(`Migration complete!`);
console.log(`  deepSearchOverview: ${overviewCount[0].c} records`);
console.log(`  financialModule: ${financialCount[0].c} records`);
console.log(`  Old propertyDeepSearch: ${oldRecords.length} records (preserved)`);
console.log(`═══════════════════════════════════════════`);

await conn.end();
