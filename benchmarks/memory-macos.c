// Read-only macOS benchmark utility. Not linked into either application.
// Coalition layout: apple-oss-distributions/xnu/bsd/sys/proc_info_private.h.
#include <libproc.h>
#include <sys/resource.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>

struct coalition_info { uint64_t id[2], reserved[3]; };
static uint64_t coalition(pid_t pid) {
    struct coalition_info info = {0};
    int size = proc_pidinfo(pid, 20, 0, &info, sizeof(info));
    return size == sizeof(info) ? info.id[0] : 0;
}
int main(int argc, char **argv) {
    if (argc != 2) { fprintf(stderr, "usage: memory-macos PID | --self\n"); return 2; }
    int self = strcmp(argv[1], "--self") == 0;
    pid_t root = self ? getpid() : (pid_t)strtol(argv[1], NULL, 10);
    if (root < 1) return 2;
    uint64_t group = coalition(root);
    if (!self && !group) { fprintf(stderr, "Cannot identify resource coalition; refusing an incomplete total.\n"); return 1; }
    int capacity = proc_listallpids(NULL, 0) + 128;
    pid_t *pids = calloc((size_t)capacity, sizeof(pid_t));
    if (!pids) return 1;
    int count = proc_listallpids(pids, capacity * (int)sizeof(pid_t));
    if (count < 0 || count >= capacity) { free(pids); return 1; }
    uint64_t total = 0;
    int seen = 0, failure = 0;
    printf("{\"root\":%d,\"coalition\":%llu,\"processes\":[", root, (unsigned long long)group);
    for (int i = 0; i < count; i++) {
        pid_t pid = pids[i];
        if (pid < 1 || (self ? pid != root : coalition(pid) != group)) continue;
        struct rusage_info_v4 usage = {0};
        if (proc_pid_rusage(pid, RUSAGE_INFO_V4, (rusage_info_t *)&usage) != 0) { failure = 1; continue; }
        char name[256] = {0};
        proc_name(pid, name, sizeof(name));
        // Executable names are diagnostic only. Escape JSON special/control bytes.
        if (seen++) printf(",");
        printf("{\"pid\":%d,\"name\":\"", pid);
        for (unsigned char *p = (unsigned char *)name; *p; p++) {
            if (*p == '"' || *p == '\\') printf("\\%c", *p);
            else if (*p < 32) printf("\\u%04x", *p);
            else putchar(*p);
        }
        printf("\",\"physicalFootprintBytes\":%llu,\"residentBytes\":%llu}",
            (unsigned long long)usage.ri_phys_footprint, (unsigned long long)usage.ri_resident_size);
        total += usage.ri_phys_footprint;
    }
    free(pids);
    printf("],\"physicalFootprintBytes\":%llu,\"complete\":%s}\n", (unsigned long long)total, (!failure && seen) ? "true" : "false");
    return failure || !seen ? 1 : 0;
}
