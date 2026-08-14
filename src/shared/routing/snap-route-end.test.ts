import { describe, expect, it } from 'vitest'
import { withSnappedEnd } from '@/shared/routing/snap-route-end'

const snappedA = { lon: 13, lat: 52, snapped: true }
const snappedB = { lon: 13.001, lat: 52, snapped: true }
const freeC = { lon: 13.002, lat: 52, snapped: false }
const freeD = { lon: 13.003, lat: 52, snapped: false }
const nodeOnEnd = { lon: 13.0031, lat: 52, dist: 2 }
const nodeFarOff = { lon: 13.004, lat: 52, dist: 40 }

describe('withSnappedEnd', () => {
  it('leaves a route that already ends snapped alone', () => {
    const waypoints = [snappedA, snappedB]
    expect(withSnappedEnd(waypoints, nodeOnEnd)).toEqual({ waypoints, change: 'none' })
  })

  it('leaves an empty route alone', () => {
    expect(withSnappedEnd([], nodeOnEnd)).toEqual({ waypoints: [], change: 'none' })
  })

  it('leaves the route alone when the graph has no node to snap to', () => {
    const waypoints = [snappedA, freeC]
    expect(withSnappedEnd(waypoints, null)).toEqual({ waypoints, change: 'none' })
  })

  it('hands the end over to the graph node it stopped on', () => {
    expect(withSnappedEnd([snappedA, freeC, freeD], nodeOnEnd)).toEqual({
      waypoints: [snappedA, freeC, { lon: nodeOnEnd.lon, lat: nodeOnEnd.lat, snapped: true }],
      change: 'moved',
    })
  })

  it('hands a lone freehand point over to the graph node', () => {
    expect(withSnappedEnd([freeD], nodeOnEnd)).toEqual({
      waypoints: [{ lon: nodeOnEnd.lon, lat: nodeOnEnd.lat, snapped: true }],
      change: 'moved',
    })
  })

  it('bridges to a graph node too far away to take over the end', () => {
    expect(withSnappedEnd([snappedA, freeC, freeD], nodeFarOff)).toEqual({
      waypoints: [
        snappedA,
        freeC,
        freeD,
        { lon: nodeFarOff.lon, lat: nodeFarOff.lat, snapped: true },
      ],
      change: 'bridged',
    })
  })

  it('bridges instead of moving so a single freehand stretch is not re-routed', () => {
    expect(withSnappedEnd([snappedA, snappedB, freeD], nodeOnEnd)).toEqual({
      waypoints: [
        snappedA,
        snappedB,
        freeD,
        { lon: nodeOnEnd.lon, lat: nodeOnEnd.lat, snapped: true },
      ],
      change: 'bridged',
    })
  })
})
