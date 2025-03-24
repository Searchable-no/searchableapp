import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Helper to check if user is admin
async function isAdmin(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  return !!profile?.is_admin;
}

// GET /api/admin/subscriptions
// Get all subscriptions (admin only)
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user and check authorization
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get subscriptions with user and plan information
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        plans (
          id,
          name,
          price,
          billing_interval
        ),
        auth.users!subscriptions_user_id_fkey (
          id,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Format the response data
    const subscriptions = data.map(subscription => ({
      id: subscription.id,
      plan: subscription.plans.name,
      price: subscription.plans.price,
      billing_interval: subscription.plans.billing_interval,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      customer_email: subscription.users.email,
      customer_id: subscription.users.id
    }));

    return NextResponse.json({ subscriptions });
  } catch (error: any) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

// POST /api/admin/subscriptions
// Create a new subscription
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user and check authorization
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get request body
    const { user_id, plan_id } = await request.json();

    if (!user_id || !plan_id) {
      return NextResponse.json(
        { error: "User ID and plan ID are required" },
        { status: 400 }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Create subscription
    const now = new Date();
    const periodEnd = new Date(now);
    
    // Set end date based on billing interval
    if (plan.billing_interval === 'month') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (plan.billing_interval === 'year') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id,
        plan_id,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: "Subscription created successfully",
      subscription
    });
  } catch (error: any) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
} 