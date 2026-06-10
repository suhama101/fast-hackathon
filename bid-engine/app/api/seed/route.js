import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseClient";
import { CAPABILITY_LIBRARY, BID_HISTORY, EVALUATION_CRITERIA_TAXONOMY } from "../../../lib/sampleData";

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();

    let capabilitySeededCount = 0;
    let bidHistorySeededCount = 0;
    let criteriaSeededCount = 0;
    
    let capabilitySkipped = false;
    let bidHistorySkipped = false;
    let criteriaSkipped = false;

    let warnings = [];

    // 1. Seed Capability Library
    try {
      const { count, error: countError } = await supabase
        .from("capability_library")
        .select("*", { count: "exact", head: true });

      if (countError) {
        throw new Error(`Failed to check existing capabilities count: ${countError.message}`);
      }

      if (count === 0) {
        // Map elements to omit local IDs because DB expects valid UUIDs for PK 'id'
        const uploadPayload = CAPABILITY_LIBRARY.map(({ id, ...rest }) => rest);
        
        const { error: insertError } = await supabase
          .from("capability_library")
          .insert(uploadPayload);

        if (insertError) {
          throw new Error(`Failed to insert into capability_library: ${insertError.message}`);
        }
        capabilitySeededCount = uploadPayload.length;
      } else {
        capabilitySkipped = true;
      }
    } catch (err) {
      console.warn("Capability Library seeding skipped/unsupported:", err.message);
      warnings.push(`Capability Library Seed Alert: ${err.message}`);
    }

    // 2. Seed Bid History
    try {
      const { count, error: countError } = await supabase
        .from("bid_history")
        .select("*", { count: "exact", head: true });

      if (!countError) {
        if (count === 0) {
          const { error: insertError } = await supabase
            .from("bid_history")
            .insert(BID_HISTORY);

          if (insertError) {
            throw new Error(`Failed to insert into bid_history: ${insertError.message}`);
          }
          bidHistorySeededCount = BID_HISTORY.length;
        } else {
          bidHistorySkipped = true;
        }
      } else {
        warnings.push("Table 'bid_history' does not exist in target database schema. Dataset exported to code module.");
      }
    } catch (err) {
      console.warn("Bid History seeding skipped/unsupported:", err.message);
      warnings.push(`Bid History Seed Alert: ${err.message}`);
    }

    // 3. Seed Evaluation Criteria Taxonomy
    try {
      const { count, error: countError } = await supabase
        .from("evaluation_criteria_taxonomy")
        .select("*", { count: "exact", head: true });

      if (!countError) {
        if (count === 0) {
          const { error: insertError } = await supabase
            .from("evaluation_criteria_taxonomy")
            .insert(EVALUATION_CRITERIA_TAXONOMY);

          if (insertError) {
            throw new Error(`Failed to insert into evaluation_criteria_taxonomy: ${insertError.message}`);
          }
          criteriaSeededCount = EVALUATION_CRITERIA_TAXONOMY.length;
        } else {
          criteriaSkipped = true;
        }
      } else {
        warnings.push("Table 'evaluation_criteria_taxonomy' does not exist in target database schema. Dataset exported to code module.");
      }
    } catch (err) {
      console.warn("Evaluation Criteria Taxonomy seeding skipped/unsupported:", err.message);
      warnings.push(`Evaluation Criteria Taxonomy Seed Alert: ${err.message}`);
    }

    // Assemble status summary response
    return NextResponse.json({
      success: true,
      message: "BidEngine AI dataset seed processing completed.",
      summary: {
        capability_library: {
          seeded: capabilitySeededCount,
          skipped: capabilitySkipped,
          message: capabilitySeededCount > 0 
            ? `Successfully seeded ${capabilitySeededCount} robust capability listings!`
            : capabilitySkipped 
            ? "Table contains existing rows. Skipped to prevent duplicates." 
            : "No records processed."
        },
        bid_history: {
          seeded: bidHistorySeededCount,
          skipped: bidHistorySkipped,
          message: bidHistorySeededCount > 0 
            ? `Successfully seeded ${bidHistorySeededCount} historical bids!`
            : bidHistorySkipped 
            ? "Table contains existing rows. Skipped to prevent duplicates." 
            : "No records processed."
        },
        evaluation_criteria_taxonomy: {
          seeded: criteriaSeededCount,
          skipped: criteriaSkipped,
          message: criteriaSeededCount > 0 
            ? `Successfully seeded ${criteriaSeededCount} evaluation parameters!`
            : criteriaSkipped 
            ? "Table contains existing rows. Skipped to prevent duplicates." 
            : "No records processed."
        }
      },
      warnings: warnings.length > 0 ? warnings : null
    }, { status: 200 });

  } catch (err) {
    console.error("Critical error in seed handler:", err);
    return NextResponse.json({
      success: false,
      error: "Failed to process database seed request: " + err.message
    }, { status: 500 });
  }
}
