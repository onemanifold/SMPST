<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

  type $$Props = DropdownMenuPrimitive.Props;

  export let open: $$Props["open"] = undefined;
</script>

<DropdownMenuPrimitive.Root bind:open {...$$restProps}>
  <slot />
</DropdownMenuPrimitive.Root>
