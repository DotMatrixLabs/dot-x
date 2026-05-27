<template>
	<dialog class="modal" :class="{ 'modal-open': visible }">
		<div class="modal-box max-w-sm">
			<h3 class="font-bold text-base mb-1">Plugin Permissions</h3>
			<p class="text-sm label-text mb-3">
				<span class="font-medium">{{ plugin?.name || plugin?.id }}</span>
				is requesting access to:
			</p>
			<ul class="flex flex-col gap-1 mb-4">
				<li
					v-for="perm in permissions"
					:key="perm.key"
					class="flex items-center gap-2 text-sm"
				>
					<i :class="perm.icon" class="w-4 text-center opacity-60"></i>
					<span>{{ perm.label }}</span>
				</li>
			</ul>
			<div class="modal-action mt-0">
				<button class="btn btn-sm btn-ghost" @click="$emit('deny')">Deny</button>
				<button class="btn btn-sm btn-primary" @click="$emit('approve')">Allow</button>
			</div>
		</div>
		<div class="modal-backdrop" @click="$emit('deny')"></div>
	</dialog>
</template>

<script>
export default {
	name: 'PluginPermissionDialog',
	props: {
		visible: {
			type: Boolean,
			default: false,
		},
		plugin: {
			type: Object,
			default: null,
		},
		permissions: {
			type: Array,
			default: () => [],
		},
	},
	emits: ['approve', 'deny'],
};
</script>
