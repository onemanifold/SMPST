<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";

  type $$Props = DropdownMenuPrimitive.LabelProps;

  let className: string | undefined = undefined;
  export { className as class };
</script>

<DropdownMenuPrimitive.Label
  class={cn("px-2 py-1.5 text-xs font-semibold text-dark-400 uppercase", className)}
  {...$$restProps}
>
  <slot />
</DropdownMenuPrimitive.Label>
