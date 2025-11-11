<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { fly, scale } from "svelte/transition";

  type $$Props = DropdownMenuPrimitive.ContentProps;

  let className: string | undefined = undefined;
  export { className as class };
  export let sideOffset: $$Props["sideOffset"] = 8;
  export let transition: $$Props["transition"] = scale;
  export let transitionConfig: $$Props["transitionConfig"] = {
    duration: 100,
    start: 0.95
  };
</script>

<DropdownMenuPrimitive.Content
  {transition}
  {transitionConfig}
  {sideOffset}
  class={cn(
    "z-50 min-w-[12rem] overflow-hidden rounded-md border border-dark-700 bg-dark-800 p-1 shadow-lg",
    className
  )}
  {...$$restProps}
>
  <slot />
</DropdownMenuPrimitive.Content>
