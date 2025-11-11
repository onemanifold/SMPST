<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";

  type $$Props = DropdownMenuPrimitive.TriggerProps;

  let className: string | undefined = undefined;
  export { className as class };
</script>

<DropdownMenuPrimitive.Trigger
  class={cn("inline-flex", className)}
  {...$$restProps}
>
  <slot />
</DropdownMenuPrimitive.Trigger>
