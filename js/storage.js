export const StorageEngine = {
    cacheTokenKey: 'nexus_follicle_matrix_state',
    firebaseLinkInstance: null,
    runtimeStateChangeCallback: null,

    loadFromLocalDisk() {
        const storedData = localStorage.getItem(this.cacheTokenKey);
        return storedData ? JSON.parse(storedData) : {};
    },

    saveState(payloadData) {
        localStorage.setItem(this.cacheTokenKey, JSON.stringify(payloadData));
        if (this.firebaseLinkInstance) {
            this.firebaseLinkInstance.pushStateToCloud(payloadData);
        }
    },

    initFirebaseBridge(activeBridge, onCloudDataRealigned) {
        this.firebaseLinkInstance = activeBridge;
        this.runtimeStateChangeCallback = onCloudDataRealigned;
        return true;
    },

    exportToFile() {
        const payloadStr = JSON.stringify(this.loadFromLocalDisk(), null, 2);
        const dataBlob = new Blob([payloadStr], { type: 'application/json' });
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = URL.createObjectURL(dataBlob);
        downloadAnchor.download = `FOLLICLE_MATRIX_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
        downloadAnchor.click();
    },

    importFromFile(fileObject, callback) {
        if (!fileObject) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsedResult = JSON.parse(e.target.result);
                this.saveState(parsedResult);
                callback(null, parsedResult);
            } catch (err) {
                callback(err, null);
            }
        };
        reader.readAsText(fileObject);
    }
};