/** Voice agent catalog templates. System prompts are spoken (STT→LLM→TTS). */

import {
  templateFirstMessage,
  templatePrompt,
} from "@/lib/voice-agent-template-prompts";


export type TemplateCategory =
  | "all"
  | "collections"
  | "reminder"
  | "recovery"
  | "lead-qualification";

export interface VoiceAgentTemplate {
  id: string;
  name: string;
  description: string;
  category: Exclude<TemplateCategory, "all">;
  seed: string;
  createdBy: string;
  callsCompleted: string;
  about: string;
  scenario: string;
  languages: string[];
  tools: string[];
  variables: string[];
  systemPrompt: string;
  firstMessage: string | null;
}

export interface RecentVoiceAgent {
  id: string;
  name: string;
  email: string;
  seed: string;
  lastEdited: string;
  lastEditedAt: number;
}

export interface ConnectivityPoint {
  hour: string;
  rate: number;
}

export const TEMPLATE_FILTERS: { id: TemplateCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "collections", label: "Collections" },
  { id: "reminder", label: "Reminder" },
  { id: "recovery", label: "Recovery" },
  { id: "lead-qualification", label: "Lead qualification" },
];

export const CONNECTIVITY_DATA: ConnectivityPoint[] = [
  { hour: "12AM", rate: 0 },
  { hour: "1AM", rate: 0 },
  { hour: "2AM", rate: 0 },
  { hour: "3AM", rate: 0 },
  { hour: "4AM", rate: 0 },
  { hour: "5AM", rate: 0 },
  { hour: "6AM", rate: 0 },
  { hour: "7AM", rate: 0 },
  { hour: "8AM", rate: 0 },
  { hour: "9AM", rate: 0 },
  { hour: "10AM", rate: 0 },
  { hour: "11AM", rate: 0 },
  { hour: "12PM", rate: 100 },
  { hour: "1PM", rate: 0 },
  { hour: "2PM", rate: 0 },
  { hour: "3PM", rate: 0 },
  { hour: "4PM", rate: 0 },
  { hour: "5PM", rate: 0 },
  { hour: "6PM", rate: 0 },
  { hour: "7PM", rate: 0 },
  { hour: "8PM", rate: 0 },
  { hour: "9PM", rate: 0 },
  { hour: "10PM", rate: 0 },
  { hour: "11PM", rate: 0 },
];

export const TOTAL_LIVE_CALLS = 1;

export const RECENT_AGENTS: RecentVoiceAgent[] = [
  {
    id: "recent-9847",
    name: "Conversation Agent 9847",
    email: "inavlabs.research@gmail.com",
    seed: "voice-agent-9847",
    lastEdited: "28m ago",
    lastEditedAt: Date.now() - 28 * 60 * 1000,
  },
  {
    id: "recent-7732",
    name: "Conversation Agent 7732",
    email: "inavlabs.research@gmail.com",
    seed: "voice-agent-7732",
    lastEdited: "20h ago",
    lastEditedAt: Date.now() - 20 * 60 * 60 * 1000,
  },
  {
    id: "recent-4411",
    name: "Collections Agent Mira",
    email: "ops@example.com",
    seed: "voice-agent-mira",
    lastEdited: "2d ago",
    lastEditedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: "recent-9021",
    name: "Appointment Agent Kai",
    email: "bookings@example.com",
    seed: "voice-agent-kai",
    lastEdited: "4d ago",
    lastEditedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: "recent-1188",
    name: "Lead Qualifier Nova",
    email: "sales@example.com",
    seed: "voice-agent-nova",
    lastEdited: "1w ago",
    lastEditedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
];

export const AGENT_TEMPLATES: VoiceAgentTemplate[] = [
  {
    id: "tpl-appointment",
    name: "Appointment management",
    description:
      "Turn customer calls into instant bookings, reschedules, and confirmations with an AI voice agent.",
    category: "reminder",
    seed: "tpl-appointment",
    createdBy: "Kupe",
    callsCompleted: "120k+",
    about:
      "Meet Kai: the AI voice agent that handles booking, confirmation, and reschedule flows without friction.",
    scenario:
      "In this scenario, you are a customer calling to book or change an appointment. Kai checks availability, confirms details, and sends a reminder.",
    languages: ["Hindi", "English", "Kannada", "Telugu", "Tamil", "Marathi"],
    tools: [
      "check_availability",
      "book_appointment",
      "reschedule_appointment",
      "cancel_appointment",
      "send_reminder",
    ],
    variables: ["userName", "companyName", "businessHours", "serviceLocation", "customerGender"],
  },
  {
    id: "tpl-sales",
    name: "Sales discovery",
    description:
      "Meet Ananya: the AI voice agent that turns warm leads into booked meetings.",
    category: "lead-qualification",
    seed: "tpl-sales",
    createdBy: "Kupe",
    callsCompleted: "38k+",
    about:
      "Meet Ananya: the AI voice agent that turns warm leads into booked meetings.",
    scenario:
      "In this scenario, you are a warm prospect. Ananya runs a discovery conversation, qualifies your opportunity, and offers to book the next step.",
    languages: ["English", "Hindi", "Tamil"],
    tools: [
      "qualify_lead",
      "check_calendar",
      "book_meeting",
      "send_followup",
    ],
    variables: ["prospectName", "companyName", "productInterest", "customerGender"],
  },
  {
    id: "tpl-emi",
    name: "EMI Collection",
    description:
      "An AI collections agent that manages EMI reminders and simplifies customer payments.",
    category: "collections",
    seed: "tpl-emi",
    createdBy: "Kupe",
    callsCompleted: "95k+",
    about:
      "Meet Ravi: the collection agent that reminds customers about EMI dues while staying empathetic and compliant.",
    scenario:
      "In this scenario, you are a customer with an upcoming EMI. Ravi confirms identity, shares the due amount, and offers payment options.",
    languages: ["Hindi", "English", "Marathi", "Kannada"],
    tools: [
      "get_emi_status",
      "send_payment_link",
      "schedule_callback",
      "log_promise_to_pay",
    ],
    variables: ["customerName", "companyName", "emiAmount", "dueDate", "loanId", "customerGender"],
  },
  {
    id: "tpl-real-estate",
    name: "Real Estate Lead Qualification",
    description:
      "An AI agent that turns property inquiries into qualified, booked site visits.",
    category: "lead-qualification",
    seed: "tpl-real-estate",
    createdBy: "Kupe",
    callsCompleted: "22k+",
    about:
      "Meet Priya: she qualifies property interest, budget, and timeline, then books a site visit.",
    scenario:
      "In this scenario, you inquired about a listing. Priya confirms budget, preferred locality, and schedules a visit with the sales team.",
    languages: ["English", "Hindi", "Telugu", "Kannada"],
    tools: [
      "capture_budget",
      "match_listings",
      "book_site_visit",
      "notify_sales",
    ],
    variables: ["buyerName", "companyName", "budgetRange", "preferredLocality", "customerGender"],
  },
  {
    id: "tpl-cart",
    name: "Cart Recovery",
    description:
      "An AI sales agent that turns abandoned carts into completed orders over the phone.",
    category: "recovery",
    seed: "tpl-cart",
    createdBy: "Kupe",
    callsCompleted: "61k+",
    about:
      "Meet Scout: the recovery agent that nudges abandoned carts toward completed orders.",
    scenario:
      "In this scenario, you left items in your cart. Scout shares a quick summary, answers product questions, and offers a checkout link.",
    languages: ["English", "Hindi", "Tamil"],
    tools: [
      "get_cart",
      "apply_coupon",
      "send_checkout_link",
      "create_support_ticket",
    ],
    variables: ["shopperName", "companyName", "cartValue", "productList", "customerGender"],
  },
  {
    id: "tpl-insurance",
    name: "Health Insurance Renewal Reminder",
    description:
      "An AI voice agent that calls policyholders to confirm health insurance renewals.",
    category: "reminder",
    seed: "tpl-insurance",
    createdBy: "Kupe",
    callsCompleted: "44k+",
    about:
      "Meet Neha: she reminds policyholders about renewal windows and helps them renew on the call.",
    scenario:
      "In this scenario, your health policy is nearing expiry. Neha confirms details, answers coverage questions, and starts the renewal.",
    languages: ["English", "Hindi", "Marathi", "Gujarati"],
    tools: [
      "get_policy_status",
      "quote_renewal",
      "start_renewal",
      "schedule_callback",
    ],
    variables: ["policyHolder", "companyName", "policyNumber", "renewalDate", "premium", "customerGender"],
  },
  {
    id: "tpl-subscription",
    name: "Subscription Renewal Reminder",
    description:
      "An AI agent that calls subscribers to prompt online subscription renewals.",
    category: "reminder",
    seed: "tpl-subscription",
    createdBy: "Kupe",
    callsCompleted: "12k+",
    about:
      "Meet Sam: he reminds subscribers their plan is ending and helps them renew online.",
    scenario:
      "In this scenario, your subscription is about to expire. Sam confirms details and shares a renewal link.",
    languages: ["English", "Hindi"],
    tools: ["get_subscription", "send_renewal_link", "schedule_callback"],
    variables: ["subscriberName", "companyName", "planName", "renewalDate", "customerGender"],
  },
  {
    id: "tpl-overdue",
    name: "Overdue Collections",
    description:
      "Follows up on past-due balances with soft escalation and promise tracking.",
    category: "collections",
    seed: "tpl-overdue",
    createdBy: "Kupe",
    callsCompleted: "77k+",
    about:
      "Meet Arjun: a collections specialist for soft overdue outreach with clear payment next steps.",
    scenario:
      "In this scenario, you have a past-due balance. Arjun confirms identity, shares the outstanding amount, and records a promise to pay.",
    languages: ["Hindi", "English", "Tamil", "Telugu"],
    tools: [
      "get_balance",
      "send_payment_link",
      "log_promise_to_pay",
      "escalate_case",
    ],
    variables: ["customerName", "companyName", "outstandingAmount", "daysPastDue", "customerGender"],
  },
  {
    id: "tpl-welcome",
    name: "Welcome & onboarding",
    description:
      "Walks new customers through first-use setup and answers onboarding FAQs.",
    category: "reminder",
    seed: "tpl-welcome",
    createdBy: "Kupe",
    callsCompleted: "18k+",
    about:
      "Meet Luna: she welcomes new customers and guides them through first-week setup.",
    scenario:
      "In this scenario, you just signed up. Luna confirms your details, walks through key features, and books a success call if needed.",
    languages: ["English", "Hindi"],
    tools: ["get_account", "send_guide", "book_success_call", "open_ticket"],
    variables: ["customerName", "companyName", "planName", "signupDate", "customerGender"],
  },
  {
    id: "tpl-feedback",
    name: "NPS feedback call",
    description:
      "Collects post-purchase feedback and routes detractors to support.",
    category: "recovery",
    seed: "tpl-feedback",
    createdBy: "Kupe",
    callsCompleted: "29k+",
    about:
      "Meet Theo: he collects NPS scores after delivery and escalates low scores immediately.",
    scenario:
      "In this scenario, you recently completed a purchase. Theo asks for a quick score and notes open feedback.",
    languages: ["English", "Hindi", "Kannada"],
    tools: ["capture_nps", "log_feedback", "create_support_ticket"],
    variables: ["customerName", "companyName", "orderId", "npsScore", "customerGender"],
  },
].map((t): VoiceAgentTemplate => ({
  ...t,
  category: t.category as VoiceAgentTemplate["category"],
  systemPrompt: templatePrompt(t.id),
  firstMessage: templateFirstMessage(t.id),
}));
