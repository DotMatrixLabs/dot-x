<template>
	<dialog class="modal" :class="{ 'modal-open': visible }">
		<div class="modal-box max-w-lg max-h-[82vh] p-0 flex flex-col overflow-hidden">
			<div class="px-6 pt-5 pb-4 overflow-y-auto">
				<h3 class="font-bold text-base mb-2">Serial device access required</h3>
				<p class="text-sm label-text leading-relaxed mb-3">
					Dot X can see <span class="font-medium">{{ deviceLabel }}</span>, but Linux has not granted this user access to
					<span class="font-mono">{{ portName }}</span>.
				</p>
				<p class="text-xs label-text leading-relaxed mb-4">
					Official Decker access is normally installed with Dot X. For development builds or DIY serial devices, copy one of these commands,
					run it on the host system, then retry. If access still fails, unplug and replug the device.
				</p>

				<div class="flex flex-col gap-3">
					<div class="rounded-md bg-base-300/60 p-3">
						<div class="flex items-start justify-between gap-3 mb-2">
							<div>
								<p class="text-sm font-medium">Official Decker</p>
								<p class="text-xs label-text">Grants access only to Frogbyte Decker USB serial devices.</p>
							</div>
							<button class="btn btn-xs btn-primary shrink-0" @click="copyCommand(deckerCommand)">
								Copy
							</button>
						</div>
						<code class="block text-[0.65rem] leading-relaxed whitespace-pre-wrap break-all bg-base-100 rounded p-2">{{ deckerCommand }}</code>
					</div>

					<div class="rounded-md bg-base-300/60 p-3">
						<div class="flex items-start justify-between gap-3 mb-2">
							<div>
								<p class="text-sm font-medium">DIY / Arduino-compatible serial devices</p>
								<p class="text-xs label-text">Grants active-user access to USB serial adapters shown as ttyACM or ttyUSB.</p>
							</div>
							<button class="btn btn-xs shrink-0" @click="copyCommand(diyCommand)">
								Copy
							</button>
						</div>
						<code class="block text-[0.65rem] leading-relaxed whitespace-pre-wrap break-all bg-base-100 rounded p-2">{{ diyCommand }}</code>
					</div>
				</div>
			</div>
			<div class="modal-action mt-0 px-6 py-3 border-t border-base-300">
				<button class="btn btn-sm btn-ghost" @click="$emit('close')">Close</button>
				<button class="btn btn-sm btn-primary" @click="$emit('retry')">Retry connection</button>
			</div>
		</div>
		<div class="modal-backdrop" @click="$emit('close')"></div>
	</dialog>
</template>

<script>
import { toast } from "vue-sonner";

const DECKER_UDEV_RULE = 'SUBSYSTEM=="tty", ATTRS{idVendor}=="04d8", ATTRS{idProduct}=="e626", MODE="0660", TAG+="uaccess"';
const DIY_ACM_RULE = 'SUBSYSTEM=="tty", KERNEL=="ttyACM[0-9]*", MODE="0660", TAG+="uaccess"';
const DIY_USB_RULE = 'SUBSYSTEM=="tty", KERNEL=="ttyUSB[0-9]*", MODE="0660", TAG+="uaccess"';

export default {
	name: "SerialAccessDialog",
	props: {
		visible: {
			type: Boolean,
			default: false,
		},
		device: {
			type: Object,
			default: null,
		},
		portName: {
			type: String,
			default: "",
		},
	},
	emits: ["close", "retry"],
	computed: {
		deviceLabel() {
			if (this.device?.product) return this.device.product;
			if (this.device?.manufacturer) return this.device.manufacturer;
			return this.portName || "the selected serial device";
		},
		deckerCommand() {
			return `sudo tee /etc/udev/rules.d/99-dot-x-decker.rules >/dev/null <<'EOF'
${DECKER_UDEV_RULE}
EOF
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=tty --action=add`;
		},
		diyCommand() {
			return `sudo tee /etc/udev/rules.d/99-dot-x-serial.rules >/dev/null <<'EOF'
${DIY_ACM_RULE}
${DIY_USB_RULE}
EOF
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=tty --action=add`;
		},
	},
	methods: {
		async copyCommand(command) {
			try {
				await navigator.clipboard.writeText(command);
				toast.success("Command copied");
			} catch (error) {
				console.error("Failed to copy serial access command:", error);
				toast.error("Failed to copy command");
			}
		},
	},
};
</script>
