# Perplexity Query: Tau Transitions in "Less is More" MPST

## Query for Verification

Please search for information about tau (τ) transitions and internal actions in the context of multiparty session types, specifically addressing:

### Primary Paper
**"Less is More: Multiparty Session Types Revisited"** by Alceste Scalas and Nobuko Yoshida (POPL 2019)

### Specific Questions

1. **CFSM Definition**: In Section 3 of Scalas & Yoshida (2019) "Less is More," how are Communicating Finite State Machines (CFSMs) formally defined? Specifically:
   - What is the action alphabet A for CFSMs?
   - Does the alphabet explicitly include tau (τ) transitions for internal/silent actions?
   - Are CFSMs defined as Labeled Transition Systems (LTS)?

2. **Reduction Semantics**: In Section 4.2 of the same paper, how is the reduction relation Γ → Γ' for typing contexts defined?
   - Does the reduction rule explicitly mention tau transitions?
   - Is the semantics "strong" (only observable actions) or "weak" (implicitly including tau closure)?
   - When a communication happens, should internal transitions be applied before reaching the next stable state?

3. **Foundational Work**: The paper builds on previous work, particularly:
   - Deniélou & Yoshida (2012) "Multiparty Session Types Meet Communicating Automata" (ESOP 2012)
   - Honda, Yoshida & Carbone (2008) "Multiparty Asynchronous Session Types" (POPL 2008)

   How do these foundational papers define CFSMs and their action alphabet?

4. **Projection and Tau**: When projecting global types to local CFSMs:
   - Do observer roles (not involved in a communication) get tau transitions?
   - How are choice branches that merge handled - with tau transitions or direct convergence?
   - Is there a formal definition of how projection introduces tau transitions?

5. **Observable vs Internal Actions**: In the operational semantics:
   - Are tau transitions meant to be applied eagerly (immediately) or lazily (on demand)?
   - Is there a notion of "weak bisimulation" or "weak transitions" that absorbs tau transitions?
   - Should the reduction relation include a tau-closure step after each communication?

### Context

I'm implementing the safety checking algorithm from "Less is More" and need to verify whether:
- Tau transitions should be applied eagerly after each communication step
- This is consistent with the formal semantics in the paper
- The implementation correctly handles the OAuth protocol example (Figure 4.1) which should be safe

### What I've Found So Far

In Deniélou & Yoshida (2012), CFSMs are defined as LTS with alphabet A = {!p⟨l⟩, ?p⟨l⟩, τ}, explicitly including tau. However, the "Less is More" reduction rule seems to only show send/receive pairs without mentioning tau.

**Question**: Is the "Less is More" reduction semantics implicitly using weak transitions (absorbing tau), or should tau transitions be handled separately?

### Desired Output

Please provide:
1. Exact quotes from the papers about CFSM definitions and reduction semantics
2. Clarification on whether tau is part of the formal model
3. How tau transitions should be handled in the operational semantics
4. Whether our interpretation (applying tau eagerly) aligns with the formal model

### Additional References to Check

- Section 3.1 (CFSMs) in Scalas & Yoshida (2019)
- Section 4.2 (Reduction semantics) in Scalas & Yoshida (2019)
- Definition of projection in Section 3.5 or 3.6
- Any mention of "weak transitions," "tau closure," or "internal actions"

Thank you!
