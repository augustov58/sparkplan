# The HVAC row asked for MCA but used it as the load (#205)

**Problem.** The Commercial Load Calculator's HVAC input was labelled "MCA (Amps)", but `commercialLoad.ts` took it as the unit's **load** (V × I × √3). MCA is a conductor-sizing value (440.33: 125 % of the largest motor plus the rest), so an entered MCA overstated the load, and "Continuous" added 125 % again in service sizing. The row cited "440.6" in the app and "220.14(C), 440.22" (OCPD sizing) in the PDF.

## Approach
1. **Owner ruling first; this is an NEC reading.** The running load (RLA, 440.6(A)) is the Article 220 load at 100 %, and "Continuous" stays a service-sizing adder (#195). Citation "NEC 220.14(C), 440.6(A)" everywhere.
2. **Sweep every surface that names the field:** form label and section heading (`CommercialLoadCalculator.tsx`), the calc's citation and comment (`commercialLoad.ts`), the PDF heading and column (`CommercialLoadDocument.tsx`), the CSV header (`commercialLoadExport.ts`). The citation is one exported constant, `HVAC_CITATION`, so the three outputs can't drift again.
3. **Keep the stored name.** `nameplateFLA` stays: sessionStorage and saved inputs use it. Only the meaning, label and comment change, and the numbers for the same input are identical (42 A × 208 V × √3 = 15,131 VA; 18,914 VA continuous).
4. **Test the outputs, not just the calc:** the unit test renders the PDF component's text and builds the CSV string; the e2e spec downloads both.

## Judgment calls
- The label reads "RLA (A)" with a tooltip ("Rated-load current from the nameplate (NEC 440.6(A)); not MCA"). Users who used to enter an MCA see the change at the field.
- The PDF's closing note "Per NEC 220.60, if heating and cooling loads are present…" is outside the ruling and unchanged.

## Reusable rule
A load input asks for the quantity the calculation uses as the load. Name it that way in the label, the citation, every export and the field comment, and keep the stored field name when only the meaning changes.
