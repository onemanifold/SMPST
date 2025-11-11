<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Variant = "default" | "secondary" | "ghost" | "simulation";
  type Size = "default" | "sm" | "lg";

  interface $$Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    class?: string;
  }

  export let variant: Variant = "default";
  export let size: Size = "default";
  let className: string | undefined = undefined;
  export { className as class };

  const variants = {
    default: "bg-gradient-to-br from-primary-500 to-primary-600 text-white hover:opacity-90 shadow-md",
    secondary: "bg-dark-700 text-dark-300 border border-dark-600 hover:bg-dark-600",
    ghost: "bg-transparent text-dark-300 hover:bg-dark-700",
    simulation: "w-8 h-8 flex items-center justify-center bg-transparent text-dark-300 hover:bg-dark-600 rounded disabled:opacity-40"
  };

  const sizes = {
    default: "px-4 py-2 text-sm",
    sm: "px-3 py-1.5 text-xs",
    lg: "px-6 py-3 text-base"
  };
</script>

<button
  type="button"
  class={cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className
  )}
  {...$$restProps}
  on:click
>
  <slot />
</button>
