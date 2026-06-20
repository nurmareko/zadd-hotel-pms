# ZADD Hotel PMS Design System V2

Version: 2.0

---

# Overview

Brainery PMS is a modern hospitality operating system.

This design system replaces the legacy Console design language.

The previous Console UI prioritized:

- terminal density
- monospace typography
- square components
- internal tooling aesthetics

Version 2 prioritizes:

- operational clarity
- modern hospitality software
- soft enterprise UI
- task-oriented workflows
- mobile-first usability

---

# Design Direction

The application should feel like:

- Mews PMS
- Cloudbeds
- Linear
- Stripe Dashboard
- Notion

The application should NOT feel like:

- Oracle Forms
- AdminLTE
- Bootstrap Admin Templates
- Internal Developer Tools
- Terminal Interfaces
- Cyberpunk Dashboards

---

# Design Philosophy

## Information First

Visual design exists to improve information clarity.

Decoration never takes priority over information.

---

## Action First

Users open Brainery PMS to complete tasks.

Every page should make the next action obvious.

---

## Operational Clarity

A user should understand the current situation within 3 seconds.

A user should identify the next action within 5 seconds.

---

## Hospitality First

Every interface should feel purpose-built for hotel operations.

Avoid generic SaaS layouts when a hospitality workflow is more appropriate.

---

# Visual Personality

The interface should feel:

- Calm
- Professional
- Organized
- Premium
- Efficient
- Trustworthy
- Modern

The interface should never feel:

- Technical
- Retro
- Developer-focused
- Experimental
- Overly playful
- Gaming-inspired

---

# Layout System

## Page Width

Full width.

No artificial content constraints.

Hotel software is operational software.

Use available screen space efficiently.

---

## Page Padding

Desktop

24px

Tablet

20px

Mobile

16px

---

## Section Gap

Desktop

24px

Mobile

16px

---

## Card Gap

16px

---

# Surface System

## Background

Primary Background

#F8FAFC

Never pure white.

Purpose:

Reduce visual fatigue during long shifts.

---

## Cards

Background

#FFFFFF

Border

#E5E7EB

Radius

16px

Shadow

Soft only

Example:

0 1px 2px rgba(0,0,0,0.05)

0 4px 8px rgba(0,0,0,0.04)

---

## Modals

Background

White

Radius

20px

Soft Shadow

Large

---

# Typography

## Font Family

Primary

Inter

Fallback

sans-serif

---

## Typography Principles

Typography should disappear.

Information should stand out.

Avoid decorative typography.

Avoid condensed typography.

Avoid monospace typography.

---

## Type Scale

Page Title

32px
700

---

Section Title

20px
600

---

Card Title

16px
600

---

Body

14px
400

---

Small Text

12px
500

---

Status Labels

12px
600

---

# Color System

## Primary

#22C55E

Used for:

- positive actions
- confirmations
- success states

---

## Blue

#3B82F6

Used for:

- active states
- occupied rooms
- informational status

---

## Amber

#F59E0B

Used for:

- pending states
- vacant dirty
- waiting actions

---

## Red

#EF4444

Used for:

- critical issues
- out of order
- failed operations

---

## Purple

#8B5CF6

Used for:

- inspections
- special workflows

---

## Neutral

Background

#F8FAFC

Card

#FFFFFF

Border

#E5E7EB

Text

#0F172A

Muted

#64748B

---

# Room Status System

VC

Vacant Clean

Blue

---

VD

Vacant Dirty

Amber

---

VCU

Vacant Clean Uninspected

Purple

---

OC

Occupied Clean

Green

---

OD

Occupied Dirty

Orange

---

OOO

Out Of Order

Red

---

OOS

Out Of Service

Gray

---

# Sidebar

## Appearance

Background

White

Border Right

1px solid #E5E7EB

---

## Width

Desktop

260px

---

## Navigation

Icons

Lucide

Size

18px

---

Active Item

Background

#F1F5F9

Text

#0F172A

Indicator

Left Accent Border

---

# Buttons

## Primary

Background

#0F172A

Text

White

Radius

12px

Height

40px

---

## Secondary

Background

White

Border

#E5E7EB

Text

#0F172A

---

## Danger

Background

#EF4444

Text

White

---

# Inputs

Height

40px

Radius

12px

Border

#D1D5DB

Focus

Blue Ring

Soft Shadow

---

# Status Chips

Status chips are one of the most important components in the PMS.

Properties:

- compact
- highly recognizable
- color coded
- consistent across all modules

Height

24px

Radius

999px

Font

12px

Weight

600

---

# Dashboard Pattern

Every dashboard follows:

1. KPI Summary
2. Priority Actions
3. Operational Content
4. Supporting Data
5. History

Never reverse this order.

---

# KPI Cards

Structure

Label

Metric

Description

Example

Occupancy

82%

131 / 160 Rooms

---

Radius

16px

Padding

20px

---

# Tables

Tables are operational tools.

Not reports.

---

Use

- soft separators
- minimal borders
- comfortable row heights
- sticky headers when needed

Avoid

- spreadsheet appearance
- dark table headers
- excessive grid lines

---

# Card Pattern

Cards are the primary layout unit.

Every major piece of information should live inside a card.

Card Structure

Header

Content

Optional Actions

---

# Mobile Philosophy

Mobile users are moving.

Many users are:

- walking
- standing
- carrying equipment

Design for speed.

Not exploration.

---

Primary actions must remain visible.

Avoid hiding important actions behind menus.

---

# Housekeeping Design Language

Housekeeping is task-oriented.

Not report-oriented.

Priority:

1. Room Number
2. Room Status
3. Primary Action
4. Guest Context
5. Notes
6. History

Users should always know:

What room needs attention next?

---

# Front Office Design Language

Front Office is guest-oriented.

Priority:

1. Arrivals
2. Departures
3. Availability
4. Guest Information
5. Billing
6. Reports

Users should always know:

Who is arriving?

Who is departing?

What rooms are available?

---

# AI Agent Instructions

When generating UI:

Always prefer:

- cards over panels
- soft hierarchy over hard borders
- whitespace over separators
- status chips over colored containers
- contextual actions over crowded toolbars
- modern SaaS patterns over legacy PMS layouts

Always use:

- Inter font
- Lucide icons
- soft shadows
- rounded cards
- pastel status colors

Never use:

- monospace typography
- square corners
- terminal aesthetics
- neon green themes
- dark admin templates
- dense spreadsheet layouts
- heavy gradients
- glassmorphism

The final result should feel like:

A premium hotel operating platform built in 2026.
