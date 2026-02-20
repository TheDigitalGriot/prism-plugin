package app

// renderSplashView renders the full-screen animated splash screen.
// Features a rotating 3D icosahedron mesh, beam particle system,
// spectral wave field, and centered "P R I S M" title with gradient bar.
func (m Model) renderSplashView() string {
	if !m.Ready {
		return "\n  Initializing..."
	}

	if m.Splash == nil {
		return "\n  Initializing..."
	}

	return m.Splash.View()
}
