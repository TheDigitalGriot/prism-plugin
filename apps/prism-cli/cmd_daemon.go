package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/daemon"
	"github.com/spf13/cobra"
)

// newDaemonCommand builds the `prism-cli daemon` command group (currently `ls`).
func newDaemonCommand() *cobra.Command {
	var url string

	daemonCmd := &cobra.Command{
		Use:   "daemon",
		Short: "Interact with the Prism daemon-broker",
		Long:  "Inspect and talk to the Prism daemon-broker — the local hub that fronts code-intel, design-gen, 3d-gen and the other brokered services.",
	}

	lsCmd := &cobra.Command{
		Use:   "ls",
		Short: "List services registered with the running daemon-broker",
		RunE: func(_ *cobra.Command, _ []string) error {
			return runDaemonLs(url)
		},
	}
	lsCmd.Flags().StringVar(&url, "url", "ws://127.0.0.1:6780", "Daemon-broker WebSocket URL")

	daemonCmd.AddCommand(lsCmd)
	return daemonCmd
}

var (
	dlStatusReady = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))  // green
	dlStatusErr   = lipgloss.NewStyle().Foreground(lipgloss.Color("203")) // red
	dlStatusWarn  = lipgloss.NewStyle().Foreground(lipgloss.Color("214")) // amber
	dlDim         = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	dlBold        = lipgloss.NewStyle().Bold(true)
)

func dlStatusStyle(s string) lipgloss.Style {
	switch s {
	case "ready", "running":
		return dlStatusReady
	case "error":
		return dlStatusErr
	case "starting":
		return dlStatusWarn
	default:
		return dlDim
	}
}

func runDaemonLs(url string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	client, err := daemon.Dial(ctx, url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Could not reach the daemon-broker at %s.\n", url)
		fmt.Fprintln(os.Stderr, "Is it running? It ships with the Prism desktop app, or start it with:")
		fmt.Fprintln(os.Stderr, "  npx tsx packages/prism-daemon/src/index.ts")
		return err
	}
	defer func() { _ = client.Close() }()

	header := dlBold.Render(fmt.Sprintf("Prism daemon-broker %s", client.BrokerVersion)) +
		dlDim.Render(fmt.Sprintf("  ·  %d service(s)  ·  session %s", len(client.Services), short(client.SessionID)))
	fmt.Println(header)
	fmt.Println()

	if len(client.Services) == 0 {
		fmt.Println(dlDim.Render("  (no services registered)"))
		return nil
	}

	for _, s := range client.Services {
		badge := dlStatusStyle(s.Status).Render(fmt.Sprintf("%-8s", s.Status))
		id := dlBold.Render(fmt.Sprintf("%-12s", s.ID))
		caps := ""
		if n := countMethods(s); n > 0 {
			caps = dlDim.Render(fmt.Sprintf("  (%d method(s))", n))
		}
		fmt.Printf("  %s  %s  %s%s\n", badge, id, s.Name, caps)
	}
	return nil
}

func countMethods(s daemon.ServiceDescriptor) int {
	n := 0
	for _, c := range s.Capabilities {
		n += len(c.Methods)
	}
	return n
}

func short(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}
