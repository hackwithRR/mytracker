export const FirebaseBridge = {
    databaseReference: null,
    activePath: 'follicle_matrix_ledger/user_state',

    connectCloudNode(configObject, onDataSynced) {
        try {
            // Programmatically inject Firebase core modules via ESM CDNs
            const firebaseAppModuleUrl = "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
            const firebaseDbModuleUrl = "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

            return {
                success: true,
                bundle: {
                    pushStateToCloud: async (payloadObj, overridePath) => {
                        const { initializeApp } = await import(firebaseAppModuleUrl);
                        const { getDatabase, ref, set } = await import(firebaseDbModuleUrl);

                        const appInstance = initializeApp(configObject);
                        const dbInstance = getDatabase(appInstance);
                        const path = overridePath || FirebaseBridge.activePath;
                        await set(ref(dbInstance, path), payloadObj);
                    },

                    readStateFromCloud: async (overridePath) => {
                        const { initializeApp } = await import(firebaseAppModuleUrl);
                        const { getDatabase, ref, get } = await import(firebaseDbModuleUrl);

                        const appInstance = initializeApp(configObject);
                        const dbInstance = getDatabase(appInstance);
                        const path = overridePath || FirebaseBridge.activePath;
                        const snap = await get(ref(dbInstance, path));
                        return snap.exists() ? snap.val() : {};
                    },

                    subscribeStateFromCloud: async (onPayload, overridePath) => {
                        const { initializeApp } = await import(firebaseAppModuleUrl);
                        const { getDatabase, ref, onValue } = await import(firebaseDbModuleUrl);

                        const appInstance = initializeApp(configObject);
                        const dbInstance = getDatabase(appInstance);
                        const path = overridePath || FirebaseBridge.activePath;
                        const r = ref(dbInstance, path);

                        const unsubscribe = onValue(r, (snap) => {
                            onPayload(snap.exists() ? snap.val() : {});
                        });

                        return () => unsubscribe();
                    }
                }
            };
        } catch (faultError) {
            return { success: false, error: faultError };
        }
    }
};

