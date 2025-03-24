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

// GET /api/admin/invoices
// Get all invoices (admin only)
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

    // Since we're still setting up, we'll return mock data for now
    // In a real implementation, you would fetch from the invoices table
    const mockInvoices = [
      {
        id: "inv_1234",
        invoice_number: "INV-001",
        amount: 199.99,
        currency: "USD",
        status: "paid",
        period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString(),
        customer_email: "customer1@example.com",
        customer_id: "user_123",
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        invoice_pdf: "https://example.com/invoice-001.pdf"
      },
      {
        id: "inv_5678",
        invoice_number: "INV-002",
        amount: 99.99,
        currency: "USD",
        status: "paid",
        period_start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        customer_email: "customer1@example.com",
        customer_id: "user_123",
        created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
        invoice_pdf: "https://example.com/invoice-002.pdf"
      },
      {
        id: "inv_9012",
        invoice_number: "INV-003",
        amount: 99.99,
        currency: "USD",
        status: "paid",
        period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString(),
        customer_email: "customer2@example.com",
        customer_id: "user_456",
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        invoice_pdf: "https://example.com/invoice-003.pdf"
      }
    ];

    return NextResponse.json({ invoices: mockInvoices });
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

// POST /api/admin/invoices
// Create a new invoice
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
    const {
      user_id,
      subscription_id,
      amount,
      currency,
      status,
      description,
      period_start,
      period_end
    } = await request.json();

    if (!user_id || !amount || !status || !period_start || !period_end) {
      return NextResponse.json(
        { error: "Required fields are missing" },
        { status: 400 }
      );
    }

    // Generate invoice number
    const invoice_number = `INV-${Date.now().toString().substring(7)}`;

    // Create invoice
    const { data: invoice, error } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id,
        subscription_id,
        amount,
        currency: currency || "USD",
        status,
        description,
        period_start,
        period_end,
        invoice_number,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: "Invoice created successfully",
      invoice
    });
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
} 