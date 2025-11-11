<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";

  type $$Props = DropdownMenuPrimitive.ItemProps;

  let className: string | undefined = undefined;
  export { className as class };
</script>

<DropdownMenuPrimitive.Item
  class={cn(
    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
    "text-dark-100 hover:bg-dark-700 focus:bg-dark-700",
    "disabled:pointer-events-none disabled:opacity-50",
    className
  )}
  {...$$restProps}
  on:click
>
  <slot />
</DropdownMenuPrimitive.Item>
