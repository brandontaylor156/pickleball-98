import React from "react"

// A screen that throws while drawing would otherwise take the whole game down to a blank page
// (React unmounts everything above the error). This catches it: a 98 message box, and "Back to
// the menu" starts the game afresh (a new key, a new engine); "Reload" reloads the page.
//   <ErrorBoundary name="Pickleball 98">...</ErrorBoundary>
export default class ErrorBoundary extends React.Component {
  state = { error: null, round: 0 }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(error, info?.componentStack)
  }

  render() {
    const { error, round } = this.state
    if (!error) return <React.Fragment key={round}>{this.props.children}</React.Fragment>
    return (
      <div className="pkGateBack" role="alertdialog" aria-labelledby="pk-crash-title" data-crash>
        <div className="window" style={{ width: "min(340px, 100%)", height: "auto", flex: "none", alignSelf: "center" }}>
          <div className="title-bar">
            <div className="title-bar-text" id="pk-crash-title">
              {this.props.name || "Pickleball 98"}
            </div>
          </div>
          <div className="window-body">
            <p>Something went wrong on that screen. Your saved players, games and settings are fine.</p>
            <div className="field-row" style={{ justifyContent: "flex-end", gap: 6 }}>
              <button type="button" onClick={() => this.setState({ error: null, round: round + 1 })}>
                Back to the menu
              </button>
              <button type="button" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
